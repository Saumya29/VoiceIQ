import HighLevelApi from '../services/highlevel-api.js';
import InstallationsDao from '../auth/installations.dao.js';
import OpenAIClient from '../services/openai-client.js';
import { buildAnalyzePrompt } from './analyze-prompt.js';
import { DEMO_AGENTS } from './demo-agents.js';
import { normalizeAgent } from './resolve-agent.js';

const AgentsController = {
  async list(req, res, next) {
    try {
      const { locationId } = req.query;

      if (!locationId) {
        return res.status(400).json({ error: 'locationId query parameter is required' });
      }

      const installation = InstallationsDao.getByLocationId(locationId);
      if (!installation) {
        return res.json({ agents: DEMO_AGENTS, demo: true });
      }

      const data = await HighLevelApi.listAgents(locationId);
      const agents = (data.agents || []).map(normalizeAgent);
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { locationId } = req.query;
      const { agentId } = req.params;

      if (!locationId) {
        return res.status(400).json({ error: 'locationId query parameter is required' });
      }

      const installation = InstallationsDao.getByLocationId(locationId);
      if (!installation) {
        const agent = DEMO_AGENTS.find(a => a.id === agentId);
        if (!agent) {
          return res.status(404).json({ error: 'Agent not found' });
        }
        return res.json({ agent, demo: true });
      }

      const data = await HighLevelApi.getAgent(locationId, agentId);
      res.json({ agent: normalizeAgent(data) });
    } catch (error) {
      next(error);
    }
  },

  async analyze(req, res, next) {
    try {
      const { locationId } = req.query;
      const { agentId } = req.params;

      if (!locationId) {
        return res.status(400).json({ error: 'locationId query parameter is required' });
      }

      let agent;
      const installation = InstallationsDao.getByLocationId(locationId);
      if (!installation) {
        agent = DEMO_AGENTS.find(a => a.id === agentId);
        if (!agent) {
          return res.status(404).json({ error: 'Agent not found' });
        }
      } else {
        const data = await HighLevelApi.getAgent(locationId, agentId);
        agent = normalizeAgent(data);
      }

      if (!agent.systemPrompt) {
        return res.status(400).json({ error: 'Agent has no system prompt to analyze' });
      }

      const prompt = buildAnalyzePrompt(agent.name, agent.systemPrompt);
      const analysis = await OpenAIClient.completeJson(prompt);
      res.json({ analysis, agent });
    } catch (error) {
      next(error);
    }
  },
};

export default AgentsController;
