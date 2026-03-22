import axios from 'axios';
import { config } from '../config/env.js';
import InstallationsDao from '../auth/installations.dao.js';

const API_VERSION = '2021-07-28';

const client = axios.create({
  baseURL: config.ghl.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Version': API_VERSION,
  },
});

async function refreshTokenIfNeeded(installation) {
  if (!installation.expires_at) return installation;

  const expiresAt = new Date(installation.expires_at);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return installation;
  }

  const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
    client_id: config.ghl.clientId,
    client_secret: config.ghl.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: installation.refresh_token,
  });

  const { access_token, refresh_token, expires_in } = response.data;
  const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  InstallationsDao.updateTokens(installation.location_id, {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: newExpiresAt,
  });

  return {
    ...installation,
    access_token,
    refresh_token,
    expires_at: newExpiresAt,
  };
}

function getAuthHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

const HighLevelApi = {
  async listAgents(locationId) {
    const installation = await refreshTokenIfNeeded(
      InstallationsDao.getByLocationId(locationId)
    );

    const response = await client.get('/voice-ai/agents', {
      params: { locationId },
      headers: getAuthHeaders(installation.access_token),
    });

    return response.data;
  },

  async getAgent(locationId, agentId) {
    const installation = await refreshTokenIfNeeded(
      InstallationsDao.getByLocationId(locationId)
    );

    const response = await client.get(`/voice-ai/agents/${agentId}`, {
      params: { locationId },
      headers: getAuthHeaders(installation.access_token),
    });

    return response.data;
  },

  async updateAgent(locationId, agentId, updates) {
    const installation = await refreshTokenIfNeeded(
      InstallationsDao.getByLocationId(locationId)
    );

    const response = await client.patch(`/voice-ai/agents/${agentId}`, updates, {
      params: { locationId },
      headers: getAuthHeaders(installation.access_token),
    });

    return response.data;
  },
};

export default HighLevelApi;
