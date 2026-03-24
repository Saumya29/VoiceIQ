import OpenAIClient from '../services/openai-client.js';
import { buildAnalyzePrompt } from '../agents/analyze-prompt.js';
import { resolveAgent } from '../agents/resolve-agent.js';
import TestGenerator from './test-generator.js';
import TestExecutor from './test-executor.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';
import TestResultDao from './test-result.dao.js';

const sseClients = new Map();
const executingRuns = new Set();

const TestsController = {
  async generate(req, res, next) {
    try {
      const { locationId, agentId } = req.body;
      const categories = req.body.categories || ['happy_path', 'edge_case', 'adversarial'];
      const casesPerCategory = req.body.casesPerCategory || 2;

      if (!locationId || !agentId) {
        return res.status(400).json({ error: 'locationId and agentId are required' });
      }

      const agent = await resolveAgent(locationId, agentId);

      if (!agent.systemPrompt) {
        return res.status(400).json({ error: 'Agent has no system prompt' });
      }

      // Run analysis first (needed for test generation context)
      const prompt = buildAnalyzePrompt(agent.name, agent.systemPrompt);
      const analysis = await OpenAIClient.completeJson(prompt);

      const { testRun, testCases } = await TestGenerator.generate(agent, analysis, {
        categories,
        casesPerCategory,
      });

      res.json({ testRun, testCases });
    } catch (error) {
      next(error);
    }
  },

  async listRuns(req, res, next) {
    try {
      const { agentId } = req.query;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId query parameter is required' });
      }
      const runs = TestRunDao.listByAgentId(agentId);
      res.json({ runs });
    } catch (error) {
      next(error);
    }
  },

  async getRun(req, res, next) {
    try {
      const { runId } = req.params;
      const run = TestRunDao.getById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Test run not found' });
      }
      const testCases = TestCaseDao.listByTestRunId(runId);
      const results = TestResultDao.listByTestRunId(runId);
      res.json({ run, testCases, results });
    } catch (error) {
      next(error);
    }
  },

  async updateTestCase(req, res, next) {
    try {
      const { caseId } = req.params;
      const { persona, scenario, successCriteria, openingMessage } = req.body;

      const existing = TestCaseDao.getById(caseId);
      if (!existing) {
        return res.status(404).json({ error: 'Test case not found' });
      }

      const updated = TestCaseDao.update(caseId, {
        persona: persona !== undefined ? persona : existing.persona,
        scenario: scenario !== undefined ? scenario : existing.scenario,
        successCriteria: successCriteria !== undefined ? successCriteria : existing.success_criteria,
        openingMessage: openingMessage !== undefined ? openingMessage : existing.opening_message,
      });

      res.json({ testCase: updated });
    } catch (error) {
      next(error);
    }
  },

  stream(req, res) {
    const { runId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    if (!sseClients.has(runId)) {
      sseClients.set(runId, []);
    }
    sseClients.get(runId).push(res);

    req.on('close', () => {
      const clients = sseClients.get(runId) || [];
      sseClients.set(runId, clients.filter(c => c !== res));
    });
  },

  async execute(req, res, next) {
    try {
      const { runId } = req.params;
      const { locationId } = req.body;

      const run = TestRunDao.getById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      if (run.status === 'running' || executingRuns.has(runId)) {
        return res.status(400).json({ error: 'Test run is already executing' });
      }

      executingRuns.add(runId);

      const agent = await resolveAgent(locationId || run.location_id, run.agent_id);

      res.json({ message: 'Execution started', runId });

      const emit = (eventName, data) => {
        const clients = sseClients.get(runId) || [];
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        clients.forEach(client => client.write(payload));
      };

      TestExecutor.execute(runId, agent.systemPrompt, emit)
        .catch(err => {
          console.error('Execution error:', err);
          emit('error', { message: err.message });
        })
        .finally(() => {
          executingRuns.delete(runId);
          sseClients.delete(runId);
        });
    } catch (error) {
      executingRuns.delete(runId);
      next(error);
    }
  },

  async retest(req, res, next) {
    try {
      const { runId } = req.params;
      const { locationId } = req.body;

      const originalRun = TestRunDao.getById(runId);
      if (!originalRun) {
        return res.status(404).json({ error: 'Original test run not found' });
      }

      const originalCases = TestCaseDao.listByTestRunId(runId);

      const newRun = TestRunDao.create({
        agentId: originalRun.agent_id,
        agentName: originalRun.agent_name,
        locationId: locationId || originalRun.location_id,
        config: originalRun.config,
        parentRunId: runId,
      });

      const casesToCopy = originalCases.map(tc => ({
        category: tc.category,
        persona: tc.persona,
        scenario: tc.scenario,
        successCriteria: tc.success_criteria,
        openingMessage: tc.opening_message,
      }));

      const newCases = TestCaseDao.createMany(newRun.id, casesToCopy);

      res.json({ testRun: TestRunDao.getById(newRun.id), testCases: newCases });
    } catch (error) {
      next(error);
    }
  },
};

export default TestsController;
