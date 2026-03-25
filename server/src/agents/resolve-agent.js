import HighLevelApi from '../services/highlevel-api.js';
import InstallationsDao from '../auth/installations.dao.js';
import { DEMO_AGENTS } from './demo-agents.js';

export function normalizeAgent(raw) {
  return {
    id: raw.id,
    locationId: raw.locationId,
    name: raw.agentName || raw.name || 'Unnamed Agent',
    businessName: raw.businessName || '',
    systemPrompt: raw.agentPrompt || raw.systemPrompt || '',
    welcomeMessage: raw.welcomeMessage || '',
    phone: raw.inboundNumber || raw.phone || null,
    voiceId: raw.voiceId || null,
    language: raw.language || 'en-US',
    maxCallDuration: raw.maxCallDuration || 900,
    actions: raw.actions || [],
    status: raw.status || (raw.inboundNumber || raw.phone ? 'active' : 'configured'),
  };
}

export async function resolveAgent(locationId, agentId) {
  const installation = InstallationsDao.getByLocationId(locationId);
  if (!installation) {
    const agent = DEMO_AGENTS.find(a => a.id === agentId);
    if (!agent) throw new Error('Agent not found');
    return normalizeAgent(agent);
  }
  const data = await HighLevelApi.getAgent(locationId, agentId);
  return normalizeAgent(data);
}
