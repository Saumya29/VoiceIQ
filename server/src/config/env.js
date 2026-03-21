import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const required = ['OPENAI_API_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/voiceiq.db',

  ghl: {
    clientId: process.env.GHL_CLIENT_ID || '',
    clientSecret: process.env.GHL_CLIENT_SECRET || '',
    redirectUri: process.env.GHL_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    apiBaseUrl: process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    agentModel: process.env.OPENAI_AGENT_MODEL || 'gpt-4o',
    callerModel: process.env.OPENAI_CALLER_MODEL || 'gpt-4o-mini',
    evaluatorModel: process.env.OPENAI_EVALUATOR_MODEL || 'gpt-4o',
  },

  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
};
