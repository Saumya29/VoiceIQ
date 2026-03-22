import HighLevelApi from '../services/highlevel-api.js';
import InstallationsDao from '../auth/installations.dao.js';
import OpenAIClient from '../services/openai-client.js';
import { buildAnalyzePrompt } from '../agents/analyze-prompt.js';
import { DEMO_AGENTS } from '../agents/demo-agents.js';
import TestGenerator from './test-generator.js';
import TestExecutor from './test-executor.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';
import TestResultDao from './test-result.dao.js';

// In-memory SSE connections keyed by runId
const sseClients = new Map();

// Shared helper to resolve agent (real or demo)
function normalizeAgent(raw) {
  return {
    id: raw.id,
    locationId: raw.locationId,
    name: raw.agentName || raw.name || 'Unnamed Agent',
    businessName: raw.businessName || '',
    systemPrompt: raw.agentPrompt || raw.systemPrompt || '',
    welcomeMessage: raw.welcomeMessage || '',
    phone: raw.inboundNumber || null,
    voiceId: raw.voiceId || null,
    language: raw.language || 'en-US',
    maxCallDuration: raw.maxCallDuration || 900,
    actions: raw.actions || [],
    status: raw.inboundNumber ? 'active' : 'configured',
  };
}

async function resolveAgent(locationId, agentId) {
  const installation = InstallationsDao.getByLocationId(locationId);
  if (!installation) {
    const agent = DEMO_AGENTS.find(a => a.id === agentId);
    if (!agent) throw new Error('Agent not found');
    return agent;
  }
  const data = await HighLevelApi.getAgent(locationId, agentId);
  return normalizeAgent(data);
}

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
        persona: persona || existing.persona,
        scenario: scenario || existing.scenario,
        successCriteria: successCriteria || existing.success_criteria,
        openingMessage: openingMessage || existing.opening_message,
      });

      res.json({ testCase: updated });
    } catch (error) {
      next(error);
    }
  },

  // SSE endpoint — client connects here to receive real-time events
  stream(req, res) {
    const { runId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Store this connection
    if (!sseClients.has(runId)) {
      sseClients.set(runId, []);
    }
    sseClients.get(runId).push(res);

    // Remove on disconnect
    req.on('close', () => {
      const clients = sseClients.get(runId) || [];
      sseClients.set(runId, clients.filter(c => c !== res));
    });
  },

  // Trigger test execution
  async execute(req, res, next) {
    try {
      const { runId } = req.params;
      const { locationId } = req.body;

      const run = TestRunDao.getById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      if (run.status === 'running') {
        return res.status(400).json({ error: 'Test run is already executing' });
      }

      // Resolve the agent to get system prompt
      const agent = await resolveAgent(locationId || run.location_id, run.agent_id);

      // Respond immediately, execution runs in background
      res.json({ message: 'Execution started', runId });

      // Emit SSE events to all connected clients for this run
      const emit = (eventName, data) => {
        const clients = sseClients.get(runId) || [];
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        clients.forEach(client => client.write(payload));
      };

      // Run execution (async, doesn't block response)
      TestExecutor.execute(runId, agent.systemPrompt, emit).catch(err => {
        console.error('Execution error:', err);
        emit('error', { message: err.message });
      });
    } catch (error) {
      next(error);
    }
  },

  // Create a new test run with the same test cases (for re-testing after optimization)
  async retest(req, res, next) {
    try {
      const { runId } = req.params;
      const { locationId } = req.body;

      const originalRun = TestRunDao.getById(runId);
      if (!originalRun) {
        return res.status(404).json({ error: 'Original test run not found' });
      }

      const originalCases = TestCaseDao.listByTestRunId(runId);

      // Create new run linked to the original
      const newRun = TestRunDao.create({
        agentId: originalRun.agent_id,
        agentName: originalRun.agent_name,
        locationId: locationId || originalRun.location_id,
        config: originalRun.config,
        parentRunId: runId,
      });

      // Copy test cases into the new run
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
