import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { MediaService } from './media.service.js';
import { SessionManager, type SessionState } from './session.manager.js';
import { SyncQueueService } from './sync-queue.service.js';
import { CrmSyncService } from './crm-sync.service.js';

export function createServer(): express.Express {
  const app = express();

  // Strict CORS: Allow local frontend dev servers or trusted production origins
  app.use(
    cors({
      origin: (origin, callback) => {
        const isLocal = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const isAllowed = origin && (
          CONFIG.ALLOWED_ORIGINS.includes(origin) ||
          origin.endsWith('.web.app') ||
          origin.endsWith('.firebaseapp.com')
        );

        if (isLocal || isAllowed) {
          callback(null, true);
        } else {
          logger.warn('CORS request blocked from origin:', { origin });
          callback(new Error('Blocked by CORS policy'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-gateway-key'],
      credentials: true,
    })
  );

  // Parse JSON with rawBody capture for Meta Webhook HMAC SHA256 validation
  app.use(
    express.json({
      limit: '25mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Protected Static Media Route
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const clientKey = req.headers['x-gateway-key'] || req.query.apiKey;
    const referer = req.headers.referer || req.headers.origin || '';
    const isLocalReferer = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(referer);
    const isAllowedReferer = referer && (
      CONFIG.ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed)) ||
      referer.includes('.web.app') ||
      referer.includes('.firebaseapp.com')
    );

    if (isLocalReferer || isAllowedReferer || clientKey === CONFIG.GATEWAY_API_KEY || (authHeader && authHeader.startsWith('Bearer '))) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Direct unauthenticated media access is restricted' });
  }, express.static(CONFIG.UPLOADS_DIR));

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

  // Dual Authentication Middleware: Firebase Auth Bearer Token OR Server Gateway Key
  const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
    // 0. Exempt Meta Webhook endpoints (validated via hub.verify_token and HMAC SHA-256)
    if (req.path.startsWith('/webhooks')) {
      return next();
    }

    // 1. Check Server API Key (Internal service-to-service)
    const clientKey = req.headers['x-gateway-key'] || req.query.apiKey;
    if (clientKey && clientKey === CONFIG.GATEWAY_API_KEY) {
      return next();
    }

    // 2. Check Firebase Auth Bearer ID Token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1].trim();
      if (idToken) {
        try {
          if (!admin.apps.length) {
            admin.initializeApp({ projectId: CONFIG.FIREBASE_PROJECT_ID });
          }
          const decoded = await admin.auth().verifyIdToken(idToken);
          (req as any).user = decoded;
          return next();
        } catch (err: any) {
          logger.warn('Invalid Firebase Auth ID token', { error: err?.message, ip: req.ip });
          return res.status(401).json({ error: 'Unauthorized: Invalid Firebase authentication token' });
        }
      }
    }

    logger.warn('Unauthorized request to WhatsApp Gateway', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid authentication token or API key',
    });
  };

  app.use('/api', authenticateRequest);

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

  // 5. Send outbound message (Baileys Web Gateway)
  app.post('/api/messages/send', async (req: Request, res: Response) => {
    const {
      accountId,
      recipientPhone,
      content,
      mediaUrl,
      mediaType,
      mediaBase64,
      fileName,
      mimeType,
    } = req.body;

    if (!recipientPhone || (!content && !mediaUrl && !mediaBase64)) {
      return res.status(400).json({
        success: false,
        error: 'recipientPhone and either content, mediaUrl, or mediaBase64 are required',
      });
    }

    try {
      const result = await SessionManager.sendOutboundMessage(
        accountId || 'default',
        recipientPhone,
        content || '',
        mediaUrl,
        mediaType,
        mediaBase64,
        fileName,
        mimeType
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      const fullMediaUrl = result.mediaUrl
        ? (result.mediaUrl.startsWith('http') ? result.mediaUrl : `http://localhost:${CONFIG.PORT}${result.mediaUrl}`)
        : undefined;

      res.json({
        success: true,
        externalMessageId: result.externalMessageId,
        mediaUrl: fullMediaUrl,
        deliveredAt: Date.now(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal error while sending WhatsApp message',
      });
    }
  });

  // 6. Send outbound message via WhatsApp Cloud API (Meta Graph API)
  app.post('/api/cloud/messages/send', async (req: Request, res: Response) => {
    const {
      phoneNumberId,
      recipientPhone,
      content,
      mediaUrl,
      mediaType,
    } = req.body;

    const targetPhoneId = phoneNumberId || CONFIG.META_CLOUD_API_PHONE_NUMBER_ID;
    const token = CONFIG.META_CLOUD_API_ACCESS_TOKEN;

    if (!recipientPhone || (!content && !mediaUrl)) {
      return res.status(400).json({
        success: false,
        error: 'recipientPhone and either content or mediaUrl are required',
      });
    }

    if (!targetPhoneId || !token) {
      return res.status(500).json({
        success: false,
        error: 'Meta Cloud API credentials are not configured on the gateway server (META_CLOUD_API_PHONE_NUMBER_ID / META_CLOUD_API_ACCESS_TOKEN)',
      });
    }

    try {
      const cleanPhone = recipientPhone.replace(/[^\d]/g, '');
      const graphUrl = `https://graph.facebook.com/${CONFIG.META_GRAPH_API_VERSION}/${targetPhoneId}/messages`;

      let payload: Record<string, any>;
      if (mediaUrl) {
        const type =
          mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' || mediaType === 'document'
            ? mediaType
            : 'document';
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type,
          [type]: {
            link: mediaUrl,
            ...(content ? { caption: content } : {}),
          },
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: content,
          },
        };
      }

      logger.info('Sending message via Meta Cloud API Graph endpoint', {
        to: cleanPhone,
        targetPhoneId,
        graphUrl,
      });

      const response = await fetch(graphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();

      if (!response.ok) {
        logger.error('Meta Cloud API returned error', { status: response.status, data });
        return res.status(response.status).json({
          success: false,
          error: data?.error?.message || 'Meta Cloud API call failed',
          metaError: data?.error,
        });
      }

      const wamid = data?.messages?.[0]?.id;

      res.json({
        success: true,
        externalMessageId: wamid,
        deliveredAt: Date.now(),
      });
    } catch (err: any) {
      logger.error('Failed to send message via Meta Cloud API', { error: err?.message });
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to send Meta Cloud API message',
      });
    }
  });

  // --- Meta WhatsApp Cloud API Webhook Endpoints ---

  // 7. Meta Webhook Verification (Challenge-Response)
  app.get('/api/webhooks/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.META_WEBHOOK_VERIFY_TOKEN) {
      logger.info('Meta Webhook verified successfully');
      return res.status(200).send(challenge);
    }

    logger.warn('Meta Webhook verification failed: invalid verify token or mode', {
      mode,
      receivedToken: token ? '***' : undefined,
    });
    return res.status(403).send('Forbidden: Invalid verify token');
  });

  // 8. Meta Webhook Event Notification Receiver
  app.post('/api/webhooks/whatsapp', async (req: Request, res: Response) => {
    // 1. Signature Verification if META_APP_SECRET is configured
    if (CONFIG.META_APP_SECRET) {
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!signature) {
        logger.warn('Meta Webhook rejected: missing x-hub-signature-256 header');
        return res.status(401).send('Unauthorized: Missing signature');
      }

      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedSignature =
        'sha256=' +
        crypto
          .createHmac('sha256', CONFIG.META_APP_SECRET)
          .update(rawBody)
          .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Meta Webhook rejected: invalid HMAC SHA-256 signature');
        return res.status(401).send('Unauthorized: Invalid signature');
      }
    }

    // 2. Meta requires immediate 200 OK
    res.status(200).send('EVENT_RECEIVED');

    // 3. Process events asynchronously
    try {
      const body = req.body;
      if (body?.object === 'whatsapp_business_account' && Array.isArray(body?.entry)) {
        for (const entry of body.entry) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value;
              const metadata = value?.metadata;
              const phoneNumberId = metadata?.phone_number_id;
              const contacts = value?.contacts || [];
              const messages = value?.messages || [];

              const contactMap: Record<string, string> = {};
              for (const c of contacts) {
                if (c.wa_id && c.profile?.name) {
                  contactMap[c.wa_id] = c.profile.name;
                }
              }

              for (const msg of messages) {
                const senderPhone = '+' + msg.from.replace(/[^\d]/g, '');
                const senderName = contactMap[msg.from] || `عميل واتساب (${senderPhone})`;
                const externalMessageId = msg.id; // wamid
                const timestamp = Number(msg.timestamp) * 1000 || Date.now();

                let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';
                let content = '';

                if (msg.type === 'text') {
                  messageType = 'text';
                  content = msg.text?.body || '';
                } else if (msg.type === 'image') {
                  messageType = 'image';
                  content = msg.image?.caption || '';
                } else if (msg.type === 'video') {
                  messageType = 'video';
                  content = msg.video?.caption || '';
                } else if (msg.type === 'audio') {
                  messageType = 'audio';
                  content = '';
                } else if (msg.type === 'document') {
                  messageType = 'document';
                  content = msg.document?.caption || msg.document?.filename || '';
                } else if (msg.type === 'button') {
                  messageType = 'text';
                  content = msg.button?.text || '';
                } else if (msg.type === 'interactive') {
                  messageType = 'text';
                  content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
                } else {
                  content = `[رسالة من نوع ${msg.type}]`;
                }

                const accountId = phoneNumberId ? `wa_cloud_${phoneNumberId}` : 'wa_cloud_default';

                const inboundPayload = {
                  accountId,
                  senderPhone,
                  senderName,
                  externalMessageId,
                  content,
                  messageType,
                  media: null,
                  timestamp,
                };

                logger.info('Received inbound Meta Cloud API message', {
                  accountId,
                  senderPhone,
                  wamid: externalMessageId,
                });

                SyncQueueService.addPendingMessage(inboundPayload);
                CrmSyncService.syncInboundMessage(inboundPayload).catch((err: any) => {
                  logger.warn('Error in background Firestore sync for Cloud API message', { error: err?.message });
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.error('Error processing Meta Webhook payload', { error: err?.message });
    }
  });

  // 6. Media Upload Endpoint
  app.post('/api/media/upload', async (req: Request, res: Response) => {
    try {
      const { fileBase64, fileName, mimeType } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: 'fileBase64 is required' });
      }

      const saved = await MediaService.saveUpload(fileBase64, fileName, mimeType);
      res.json({
        success: true,
        mediaUrl: `http://localhost:${CONFIG.PORT}${saved.publicUrl}`,
        relativePath: saved.publicUrl,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        sizeBytes: saved.fileSizeBytes,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to upload media' });
    }
  });

  // 7. Resolve LID to real Phone Endpoint
  app.get('/api/accounts/:accountId/resolve-phone/:target', async (req: Request, res: Response) => {
    const { accountId, target } = req.params;
    try {
      const phone = await SessionManager.resolvePhoneNumber(accountId, target);
      res.json({ success: true, target, phone });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to resolve phone' });
    }
  });

  // 6. List all session states (admin audit)
  app.get('/api/accounts', (_req: Request, res: Response) => {
    const sessions = SessionManager.getAllSessions().map(formatSessionResponse);
    res.json({ sessions });
  });

  // 7. Get pending sync messages (for client-side Firebase sync)
  app.get('/api/sync/pending', (_req: Request, res: Response) => {
    const pending = SyncQueueService.getPendingMessages();
    res.json({ success: true, pending });
  });

  // 8. Acknowledge processed messages
  app.post('/api/sync/ack', (req: Request, res: Response) => {
    const messageIds = req.body?.messageIds || [];
    SyncQueueService.ackMessages(messageIds);
    res.json({ success: true });
  });

  return app;
}
