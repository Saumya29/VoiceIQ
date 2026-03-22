import OpenAIClient from '../services/openai-client.js';
import HighLevelApi from '../services/highlevel-api.js';
import InstallationsDao from '../auth/installations.dao.js';
import { DEMO_AGENTS } from '../agents/demo-agents.js';
import { buildOptimizePrompt } from './optimize-prompt.js';
import OptimizationDao from './optimizations.dao.js';
import TestRunDao from '../tests/test-run.dao.js';
import TestCaseDao from '../tests/test-case.dao.js';
import TestResultDao from '../tests/test-result.dao.js';

function normalizeAgent(raw) {
  return {
    id: raw.id,
    locationId: raw.locationId,
    name: raw.agentName || raw.name || 'Unnamed Agent',
    systemPrompt: raw.agentPrompt || raw.systemPrompt || '',
  };
}

async function resolveAgent(locationId, agentId) {
  const installation = InstallationsDao.getByLocationId(locationId);
  if (!installation) {
    return DEMO_AGENTS.find(a => a.id === agentId);
  }
  const data = await HighLevelApi.getAgent(locationId, agentId);
  return normalizeAgent(data);
}

const OptimizationsController = {
  async generate(req, res, next) {
    try {
      const { runId, locationId } = req.body;

      if (!runId || !locationId) {
        return res.status(400).json({ error: 'runId and locationId are required' });
      }

      const run = TestRunDao.getById(runId);
      if (!run) {
        return res.status(404).json({ error: 'Test run not found' });
      }

      const agent = await resolveAgent(locationId, run.agent_id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Get test results with their test case data
      const results = TestResultDao.listByTestRunId(runId);
      const testCases = TestCaseDao.listByTestRunId(runId);

      const enrichedResults = results.map(r => {
        const tc = testCases.find(c => c.id === r.test_case_id);
        return { ...r, scenario: tc?.scenario || '' };
      });

      const failedResults = enrichedResults.filter(r => r.verdict === 'fail' || r.verdict === 'partial');
      const passedResults = enrichedResults.filter(r => r.verdict === 'pass');

      if (failedResults.length === 0) {
        return res.status(400).json({ error: 'No failed tests to optimize for' });
      }

      // Create optimization record
      const optimization = OptimizationDao.create({
        agentId: run.agent_id,
        testRunId: runId,
        locationId,
        originalPrompt: agent.systemPrompt,
      });

      // Generate optimized prompt
      const prompt = buildOptimizePrompt(agent.systemPrompt, failedResults, passedResults);
      const result = await OpenAIClient.completeJson(prompt, { maxTokens: 8000 });

      // Compute simple line diff
      const originalLines = agent.systemPrompt.split('\n');
      const optimizedLines = result.optimizedPrompt.split('\n');
      const promptDiff = { original: originalLines, optimized: optimizedLines };

      const completed = OptimizationDao.complete(optimization.id, {
        optimizedPrompt: result.optimizedPrompt,
        promptDiff,
        failurePatterns: result.failurePatterns || [],
        changesSummary: result.changes || [],
        expectedImprovements: result.expectedImprovements || '',
      });

      res.json({ optimization: completed });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { optimizationId } = req.params;
      const optimization = OptimizationDao.getById(optimizationId);
      if (!optimization) {
        return res.status(404).json({ error: 'Optimization not found' });
      }
      res.json({ optimization });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const { agentId } = req.query;
      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }
      const optimizations = OptimizationDao.listByAgentId(agentId);
      res.json({ optimizations });
    } catch (error) {
      next(error);
    }
  },

  async approve(req, res, next) {
    try {
      const { optimizationId } = req.params;
      const optimization = OptimizationDao.getById(optimizationId);
      if (!optimization) {
        return res.status(404).json({ error: 'Optimization not found' });
      }
      const updated = OptimizationDao.updateStatus(optimizationId, 'approved');
      res.json({ optimization: updated });
    } catch (error) {
      next(error);
    }
  },

  async apply(req, res, next) {
    try {
      const { optimizationId } = req.params;
      const optimization = OptimizationDao.getById(optimizationId);
      if (!optimization) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      if (optimization.status !== 'approved') {
        return res.status(400).json({ error: 'Optimization must be approved before applying' });
      }

      // Push to HighLevel
      const installation = InstallationsDao.getByLocationId(optimization.location_id);
      if (installation) {
        await HighLevelApi.updateAgent(
          optimization.location_id,
          optimization.agent_id,
          { agentPrompt: optimization.optimized_prompt }
        );
      }

      const updated = OptimizationDao.updateStatus(optimizationId, 'applied');
      res.json({ optimization: updated });
    } catch (error) {
      next(error);
    }
  },

  async reject(req, res, next) {
    try {
      const { optimizationId } = req.params;
      const updated = OptimizationDao.updateStatus(optimizationId, 'rejected');
      res.json({ optimization: updated });
    } catch (error) {
      next(error);
    }
  },
};

export default OptimizationsController;
