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
  SESSIONS_DIR: process.env.SESSIONS_DIR ? path.resolve(process.env.SESSIONS_DIR) : path.resolve(__dirname, '../sessions'),
  UPLOADS_DIR: process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(__dirname, '../uploads'),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'crm-awlad-yahya',
  FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_RECONNECT_DELAY_MS: 2000,
  MAX_RECONNECT_DELAY_MS: 30000,

  // Meta WhatsApp Cloud API Configuration (Kept server-side only)
  META_APP_SECRET: process.env.META_APP_SECRET || '',
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_verify_token_2026',
  META_CLOUD_API_ACCESS_TOKEN: process.env.META_CLOUD_API_ACCESS_TOKEN || '',
  META_CLOUD_API_PHONE_NUMBER_ID: process.env.META_CLOUD_API_PHONE_NUMBER_ID || '',
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v21.0',
  META_WABA_ID: process.env.META_WABA_ID || '',
};
