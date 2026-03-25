import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const required = ['OPENAI_API_KEY'];
const databasePathFromEnv = process.env.DATABASE_PATH;
const shouldUseRailwayVolumePath = Boolean(
  process.env.RAILWAY_VOLUME_MOUNT_PATH
  && (!databasePathFromEnv || databasePathFromEnv === './data/voiceiq.db')
);
const defaultDatabasePath = shouldUseRailwayVolumePath
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'voiceiq.db')
  : (databasePathFromEnv || './data/voiceiq.db');

function parseOrigins(value, defaults) {
  if (!value) {
    return defaults;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: defaultDatabasePath,
  clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:5173',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS, [
    'http://localhost:5173',
    'http://localhost:3001',
  ]),

  ghl: {
    clientId: process.env.GHL_CLIENT_ID || '',
    clientSecret: process.env.GHL_CLIENT_SECRET || '',
    redirectUri: process.env.GHL_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    installUrl: process.env.GHL_INSTALL_URL || '',
    apiBaseUrl: process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com',
    ssoKey: process.env.GHL_SSO_KEY || '',
    appUrl: process.env.GHL_APP_URL || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    agentModel: process.env.OPENAI_AGENT_MODEL || 'gpt-4o',
    callerModel: process.env.OPENAI_CALLER_MODEL || 'gpt-4o-mini',
    evaluatorModel: process.env.OPENAI_EVALUATOR_MODEL || 'gpt-4o',
  },

  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
};
