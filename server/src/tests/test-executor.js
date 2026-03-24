import { config } from '../config/env.js';
import OpenAIClient from '../services/openai-client.js';
import { buildSyntheticCallerPrompt } from './synthetic-caller-prompt.js';
import { buildEvaluatePrompt } from './evaluate-prompt.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';
import TestResultDao from './test-result.dao.js';

const MAX_TURNS = 10;

const TestExecutor = {
  /**
   * Execute all test cases for a run. Emits SSE events via the emit callback.
   * @param {string} runId
   * @param {string} agentSystemPrompt - The agent's system prompt
   * @param {function} emit - (eventName, data) => void
   */
  async execute(runId, agentSystemPrompt, emit) {
    const testCases = TestCaseDao.listByTestRunId(runId);
    const executedIds = TestResultDao.getExecutedCaseIds(runId);

    TestRunDao.updateStatus(runId, 'running');

    for (const tc of testCases) {
      // Skip already-executed cases (resume support)
      if (executedIds.includes(tc.id)) continue;

      emit('test_case_started', { testCaseId: tc.id, scenario: tc.scenario });

      // Clean up any incomplete result rows from a previous crashed run
      TestResultDao.deleteIncomplete(runId, tc.id);

      const resultId = TestResultDao.create({ testRunId: runId, testCaseId: tc.id });

      try {
        // Run the conversation
        const conversation = await this.runConversation(agentSystemPrompt, tc);

        // Evaluate the conversation
        const evaluation = await this.evaluateConversation(
          conversation, tc.success_criteria, tc.scenario
        );

        // Add conciseness metric (voice-specific: long responses are bad on phone)
        const agentTurns = conversation.filter(t => t.role === 'agent');
        const wordCounts = agentTurns.map(t => t.content.split(/\s+/).length);
        const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / (wordCounts.length || 1));
        const maxWords = Math.max(...wordCounts, 0);
        const CONCISE_LIMIT = 80; // ~30 seconds of speech
        const conciseScore = maxWords <= CONCISE_LIMIT ? 100 : Math.max(0, 100 - (maxWords - CONCISE_LIMIT) * 2);
        evaluation.conciseness = { avgWords, maxWords, score: conciseScore };

        // Persist result (include conciseness in criteria results for display)
        TestResultDao.complete(resultId, {
          conversation,
          criteriaResults: [...evaluation.criteriaResults, {
            id: 'conciseness',
            description: `Response conciseness (avg ${evaluation.conciseness.avgWords} words, max ${evaluation.conciseness.maxWords} words per turn)`,
            passed: evaluation.conciseness.score >= 70,
            score: evaluation.conciseness.score,
            reasoning: evaluation.conciseness.maxWords > CONCISE_LIMIT
              ? `Longest response was ${evaluation.conciseness.maxWords} words (limit: ${CONCISE_LIMIT}). On a phone call, this would take over 30 seconds to speak.`
              : `All responses were within the ${CONCISE_LIMIT}-word limit. Good for voice delivery.`,
            evidence: '',
          }],
          overallScore: evaluation.overallScore,
          verdict: evaluation.verdict,
          turnCount: conversation.length,
        });

        // Update run counters
        TestRunDao.incrementResults(runId, evaluation.verdict);

        emit('test_case_completed', {
          testCaseId: tc.id,
          verdict: evaluation.verdict,
          overall_score: evaluation.overallScore,
          summary: evaluation.summary,
        });
      } catch (err) {
        TestResultDao.setError(resultId, err.message);
        TestRunDao.incrementResults(runId, 'fail');

        emit('test_case_completed', {
          testCaseId: tc.id,
          verdict: 'fail',
          overall_score: 0,
          summary: `Error: ${err.message}`,
        });
      }
    }

    // Compute overall score
    const results = TestResultDao.listByTestRunId(runId);
    const scores = results
      .filter(r => r.overall_score !== null)
      .map(r => r.overall_score);
    const overallScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    TestRunDao.updateScore(runId, overallScore);
    TestRunDao.updateStatus(runId, 'completed');

    emit('run_completed', { runId, overallScore });
  },

  /**
   * Drive a multi-turn conversation between agent and synthetic caller.
   */
  async runConversation(agentSystemPrompt, testCase) {
    const conversation = [];
    const callerSystemPrompt = buildSyntheticCallerPrompt(testCase.persona);

    // Caller opens with their opening message
    conversation.push({ role: 'caller', content: testCase.opening_message });

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // Agent responds
      const agentMessages = [
        { role: 'system', content: agentSystemPrompt },
        ...conversation.map(t => ({
          role: t.role === 'agent' ? 'assistant' : 'user',
          content: t.content,
        })),
      ];

      const agentResponse = await OpenAIClient.chat(agentMessages, {
        model: config.openai.agentModel,
        temperature: 0.3,
        maxTokens: 500,
      });

      conversation.push({ role: 'agent', content: agentResponse });

      // Check if agent ended the conversation
      if (agentResponse.includes('[END_CONVERSATION]') || agentResponse.includes('goodbye') || agentResponse.includes('Goodbye')) {
        break;
      }

      // Caller responds
      const callerMessages = [
        { role: 'system', content: callerSystemPrompt },
        ...conversation.map(t => ({
          role: t.role === 'caller' ? 'assistant' : 'user',
          content: t.content,
        })),
      ];

      const callerResponse = await OpenAIClient.chat(callerMessages, {
        model: config.openai.callerModel,
        temperature: 0.8,
        maxTokens: 300,
      });

      const cleanedResponse = callerResponse.replace('[END_CONVERSATION]', '').trim();
      conversation.push({ role: 'caller', content: cleanedResponse });

      // Check if caller ended the conversation
      if (callerResponse.includes('[END_CONVERSATION]')) {
        break;
      }
    }

    return conversation;
  },

  /**
   * Evaluate a completed conversation against success criteria.
   */
  async evaluateConversation(conversation, successCriteria, scenario) {
    const prompt = buildEvaluatePrompt(conversation, successCriteria, scenario);
    const evaluation = await OpenAIClient.completeJson(prompt, {
      model: config.openai.evaluatorModel,
      temperature: 0,
      maxTokens: 4000,
    });
    return evaluation;
  },
};

export default TestExecutor;
