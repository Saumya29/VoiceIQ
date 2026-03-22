import HighLevelApi from '../services/highlevel-api.js';
import InstallationsDao from '../auth/installations.dao.js';
import OpenAIClient from '../services/openai-client.js';
import { buildAnalyzePrompt } from '../agents/analyze-prompt.js';
import { DEMO_AGENTS } from '../agents/demo-agents.js';
import TestGenerator from './test-generator.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';
import TestResultDao from './test-result.dao.js';

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
};

export default TestsController;
