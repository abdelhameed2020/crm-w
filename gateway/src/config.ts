import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env if available, then local gateway .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const CONFIG = {
  PORT: parseInt(process.env.GATEWAY_PORT || '5001', 10),
  GATEWAY_API_KEY: process.env.GATEWAY_API_KEY || process.env.VITE_GATEWAY_API_KEY || 'crm_gateway_secret_2026',
  SESSIONS_DIR: path.resolve(__dirname, '../sessions'),
  UPLOADS_DIR: path.resolve(__dirname, '../uploads'),
  FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'crm-awlad-yahya',
  FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_RECONNECT_DELAY_MS: 2000,
  MAX_RECONNECT_DELAY_MS: 30000,
};
