import { config } from '../config/env.js';
import OpenAIClient from '../services/openai-client.js';
import { buildSyntheticCallerPrompt } from './synthetic-caller-prompt.js';
import { buildEvaluatePrompt } from './evaluate-prompt.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';
import TestResultDao from './test-result.dao.js';

const MAX_TURNS = 10;
const CONCURRENCY = 3;

const TestExecutor = {
  async executeOne(runId, agentSystemPrompt, tc, emit) {
    emit('test_case_started', { testCaseId: tc.id, scenario: tc.scenario });

    TestResultDao.deleteIncomplete(runId, tc.id);
    const resultId = TestResultDao.create({ testRunId: runId, testCaseId: tc.id });

    try {
      const conversation = await this.runConversation(agentSystemPrompt, tc);
      const evaluation = await this.evaluateConversation(
        conversation, tc.success_criteria, tc.scenario
      );

      const agentTurns = conversation.filter(t => t.role === 'agent');
      const wordCounts = agentTurns.map(t => t.content.split(/\s+/).length);
      const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / (wordCounts.length || 1));
      const maxWords = Math.max(...wordCounts, 0);
      const CONCISE_LIMIT = 80;
      const conciseScore = maxWords <= CONCISE_LIMIT ? 100 : Math.max(0, 100 - (maxWords - CONCISE_LIMIT) * 2);
      evaluation.conciseness = { avgWords, maxWords, score: conciseScore };

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
  },

  async execute(runId, agentSystemPrompt, emit) {
    const testCases = TestCaseDao.listByTestRunId(runId);
    const executedIds = TestResultDao.getExecutedCaseIds(runId);
    const pending = testCases.filter(tc => !executedIds.includes(tc.id));

    TestRunDao.updateStatus(runId, 'running');

    // Run test cases in parallel batches
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(tc => this.executeOne(runId, agentSystemPrompt, tc, emit)));
    }

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

  async runConversation(agentSystemPrompt, testCase) {
    const conversation = [];
    const callerSystemPrompt = buildSyntheticCallerPrompt(testCase.persona);

    conversation.push({ role: 'caller', content: testCase.opening_message });

    for (let turn = 0; turn < MAX_TURNS; turn++) {
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

      if (agentResponse.includes('[END_CONVERSATION]') || agentResponse.includes('goodbye') || agentResponse.includes('Goodbye')) {
        break;
      }

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

      if (callerResponse.includes('[END_CONVERSATION]')) {
        break;
      }
    }

    return conversation;
  },

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
