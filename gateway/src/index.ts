import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { createServer } from './server.js';
import { SessionManager } from './session.manager.js';

async function bootstrap() {
  try {
    const app = createServer();

    const server = app.listen(CONFIG.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 WhatsApp Web Gateway started on http://localhost:${CONFIG.PORT}`);
      logger.info(`🔒 Security: API Key authentication active`);
      logger.info(`📁 Sessions folder: ${CONFIG.SESSIONS_DIR}`);
      logger.info(`📁 Uploads folder: ${CONFIG.UPLOADS_DIR}`);
      logger.info(`=======================================================`);
    });

    // Auto-restore any existing sessions
    await SessionManager.restorePersistedSessions();

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down WhatsApp Gateway gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    logger.error('Fatal error starting WhatsApp Gateway', { error: err?.message });
    process.exit(1);
  }
}

bootstrap();
