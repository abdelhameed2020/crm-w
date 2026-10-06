import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { SessionManager, type SessionState } from './session.manager.js';

export function createServer(): express.Express {
  const app = express();

  // Enable CORS for frontend Vite dev server
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-gateway-key'],
    })
  );

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Static files for media uploads/downloads
  app.use('/uploads', express.static(CONFIG.UPLOADS_DIR));

  // Root index endpoint (public)
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'OmniCRM WhatsApp Web Gateway',
      version: '1.0.0',
      status: 'running',
      healthUrl: '/health',
      activeSessions: SessionManager.getAllSessions().filter((s) => s.status === 'connected').length,
    });
  });

  // Health check endpoint (public)
  app.get('/health', (_req: Request, res: Response) => {
    const sessions = SessionManager.getAllSessions();
    res.json({
      status: 'ok',
      isOnline: true,
      uptime: Math.round(process.uptime()),
      activeSessions: sessions.filter((s) => s.status === 'connected').length,
      totalSessions: sessions.length,
      timestamp: Date.now(),
    });
  });

  // API Key Protection Middleware
  const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    const clientKey = req.headers['x-gateway-key'] || req.query.apiKey;
    if (!clientKey || clientKey !== CONFIG.GATEWAY_API_KEY) {
      logger.warn('Unauthorized request attempt to WhatsApp Gateway', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing Gateway API key (x-gateway-key)',
      });
    }
    next();
  };

  app.use('/api', requireApiKey);

  // Helper to format session response to WhatsAppSessionQrResponse
  const formatSessionResponse = (state: SessionState) => {
    let status: 'disconnected' | 'connecting' | 'waiting_for_qr' | 'connected' | 'reconnecting' | 'error' =
      state.status === 'qr_ready' ? 'waiting_for_qr' : (state.status as any);

    if (state.reconnectAttempts > 0 && state.status === 'disconnected') {
      status = 'reconnecting';
    }

    return {
      accountId: state.accountId,
      status,
      qrDataUrl: state.qrCodeDataUrl || undefined,
      phoneNumber: state.phoneNumber || undefined,
      error: state.lastError || undefined,
    };
  };

  // 1. Initialize or start a WhatsApp session
  app.post('/api/accounts/initialize', async (req: Request, res: Response) => {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    try {
      const state = await SessionManager.startSession(accountId);
      res.json(formatSessionResponse(state));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to initialize session' });
    }
  });

  // 2. Get QR Code status
  app.get('/api/accounts/:accountId/qr', (req: Request, res: Response) => {
    const { accountId } = req.params;
    const state = SessionManager.getSessionState(accountId);
    res.json(formatSessionResponse(state));
  });

  // 3. Disconnect session
  app.post('/api/accounts/:accountId/disconnect', async (req: Request, res: Response) => {
    const { accountId } = req.params;
    const clearSession = Boolean(req.body?.clearSession);

    try {
      await SessionManager.disconnectSession(accountId, clearSession);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to disconnect session' });
    }
  });

  // 4. Reconnect session
  app.post('/api/accounts/:accountId/reconnect', async (req: Request, res: Response) => {
    const { accountId } = req.params;

    try {
      const state = await SessionManager.startSession(accountId);
      res.json(formatSessionResponse(state));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to reconnect session' });
    }
  });

  // 5. Send outbound message
  app.post('/api/messages/send', async (req: Request, res: Response) => {
    const { accountId, recipientPhone, content, mediaUrl, mediaType } = req.body;

    if (!accountId || !recipientPhone || (!content && !mediaUrl)) {
      return res.status(400).json({
        success: false,
        error: 'accountId, recipientPhone, and either content or mediaUrl are required',
      });
    }

    try {
      const result = await SessionManager.sendOutboundMessage(
        accountId,
        recipientPhone,
        content || '',
        mediaUrl,
        mediaType
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        externalMessageId: result.externalMessageId,
        deliveredAt: Date.now(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal error while sending WhatsApp message',
      });
    }
  });

  // 6. List all session states (admin audit)
  app.get('/api/accounts', (_req: Request, res: Response) => {
    const sessions = SessionManager.getAllSessions().map(formatSessionResponse);
    res.json({ sessions });
  });

  return app;
}
