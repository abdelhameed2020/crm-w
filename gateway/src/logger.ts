import pino from 'pino';

// Create a safe pino logger with redactions
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'token',
      'key',
      'apiKey',
      'secret',
      'password',
      'creds',
      '*.creds',
      'auth',
      '*.auth',
      'headers.authorization',
      'headers["x-gateway-key"]',
    ],
    censor: '[REDACTED_SECRET]',
  },
});

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    baseLogger.info(meta || {}, `[WhatsAppGateway] ${msg}`);
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    baseLogger.warn(meta || {}, `[WhatsAppGateway] ${msg}`);
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    baseLogger.error(meta || {}, `[WhatsAppGateway] ${msg}`);
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    baseLogger.debug(meta || {}, `[WhatsAppGateway] ${msg}`);
  },
};
