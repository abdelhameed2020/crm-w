import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { MediaService } from './media.service.js';
import { CrmSyncService } from './crm-sync.service.js';

export interface SessionState {
  accountId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  qrGeneratedAt: number | null;
  phoneNumber: string | null;
  reconnectAttempts: number;
  lastError: string | null;
}

interface InternalSession extends SessionState {
  socket: ReturnType<typeof makeWASocket> | null;
  reconnectTimer: NodeJS.Timeout | null;
}

export class SessionManager {
  private static sessions = new Map<string, InternalSession>();

  /**
   * Initialize sessions directory
   */
  static init(): void {
    if (!fs.existsSync(CONFIG.SESSIONS_DIR)) {
      fs.mkdirSync(CONFIG.SESSIONS_DIR, { recursive: true });
    }
  }

  /**
   * Automatically restore sessions that have saved credentials
   */
  static async restorePersistedSessions(): Promise<void> {
    try {
      this.init();
      const entries = fs.readdirSync(CONFIG.SESSIONS_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const credsPath = path.join(CONFIG.SESSIONS_DIR, entry.name, 'creds.json');
          if (fs.existsSync(credsPath)) {
            logger.info('Found existing WhatsApp session, restoring...', { accountId: entry.name });
            this.startSession(entry.name).catch((err) => {
              logger.error('Failed to restore session', { accountId: entry.name, error: err?.message });
            });
          }
        }
      }
    } catch (err: any) {
      logger.error('Error while restoring sessions', { error: err?.message });
    }
  }

  /**
   * Get or create in-memory session record
   */
  private static getOrCreateSession(accountId: string): InternalSession {
    let session = this.sessions.get(accountId);
    if (!session) {
      session = {
        accountId,
        socket: null,
        status: 'disconnected',
        qrCodeDataUrl: null,
        qrRaw: null,
        qrGeneratedAt: null,
        phoneNumber: null,
        reconnectAttempts: 0,
        lastError: null,
        reconnectTimer: null,
      };
      this.sessions.set(accountId, session);
    }
    return session;
  }

  /**
   * Start or restart a WhatsApp Web Baileys socket for an account
   */
  static async startSession(accountId: string): Promise<SessionState> {
    this.init();
    const session = this.getOrCreateSession(accountId);

    // If already connected, return current state
    if (session.status === 'connected' && session.socket) {
      return this.getSessionState(accountId);
    }

    // Clear any pending reconnect timers
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    session.status = 'connecting';
    session.lastError = null;
    await CrmSyncService.updateAccountStatus(accountId, 'connecting');

    const sessionAuthPath = path.join(CONFIG.SESSIONS_DIR, accountId);
    if (!fs.existsSync(sessionAuthPath)) {
      fs.mkdirSync(sessionAuthPath, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionAuthPath);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info('Fetched WhatsApp version', { version: version.join('.'), isLatest });

      // Silent Baileys internal logger to avoid terminal noise
      const baileysLogger = pino({ level: 'silent' });

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        logger: baileysLogger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('OmniCRM Gateway'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
      });

      session.socket = sock;

      // Handle credentials save
      sock.ev.on('creds.update', saveCreds);

      // Handle connection updates (QR code & connection lifecycle)
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
            session.qrCodeDataUrl = qrDataUrl;
            session.qrRaw = qr;
            session.qrGeneratedAt = Date.now();
            session.status = 'qr_ready';
            logger.info('New WhatsApp QR code generated', { accountId });
            await CrmSyncService.updateAccountStatus(accountId, 'qr_ready');
          } catch (qrErr: any) {
            logger.error('Failed to convert QR code to Data URL', { error: qrErr?.message });
          }
        }

        if (connection === 'open') {
          session.status = 'connected';
          session.qrCodeDataUrl = null;
          session.qrRaw = null;
          session.qrGeneratedAt = null;
          session.reconnectAttempts = 0;
          session.lastError = null;

          const userJid = sock.user?.id || '';
          const rawPhone = userJid.split(':')[0] || userJid.split('@')[0];
          session.phoneNumber = rawPhone ? `+${rawPhone}` : null;

          logger.info('WhatsApp Web session connected successfully!', {
            accountId,
            phone: session.phoneNumber,
          });

          await CrmSyncService.updateAccountStatus(accountId, 'connected', {
            phoneNumber: session.phoneNumber || undefined,
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          logger.warn('WhatsApp session closed', {
            accountId,
            statusCode,
            isLoggedOut,
            error: (lastDisconnect?.error as any)?.message,
          });

          if (isLoggedOut) {
            session.status = 'disconnected';
            session.qrCodeDataUrl = null;
            session.socket = null;
            session.reconnectAttempts = 0;

            // Remove stored creds to allow clean re-scan
            try {
              if (fs.existsSync(sessionAuthPath)) {
                fs.rmSync(sessionAuthPath, { recursive: true, force: true });
              }
            } catch (rmErr: any) {
              logger.warn('Failed removing invalidated session files', { error: rmErr?.message });
            }

            await CrmSyncService.updateAccountStatus(accountId, 'disconnected', {
              errorMessage: 'الجلسة انتهت (سجل خروج من الهاتف)',
            });
          } else {
            // Reconnection logic with exponential backoff
            session.status = 'disconnected';
            session.socket = null;

            if (session.reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
              const delay = Math.min(
                CONFIG.BASE_RECONNECT_DELAY_MS * Math.pow(1.5, session.reconnectAttempts),
                CONFIG.MAX_RECONNECT_DELAY_MS
              );
              session.reconnectAttempts += 1;

              logger.info(`Scheduling reconnect in ${Math.round(delay / 1000)}s (attempt ${session.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})`, {
                accountId,
              });

              session.reconnectTimer = setTimeout(() => {
                this.startSession(accountId).catch((reconnectErr) => {
                  logger.error('Reconnect attempt failed', { accountId, error: reconnectErr?.message });
                });
              }, delay);
            } else {
              session.status = 'error';
              session.lastError = 'فشل الاتصال بعد محاولات متعددة. اضغط إعادة الاتصال يدوياً.';
              logger.error('Max reconnection attempts reached', { accountId });
              await CrmSyncService.updateAccountStatus(accountId, 'error', {
                errorMessage: session.lastError,
              });
            }
          }
        }
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          try {
            await this.processIncomingMessage(accountId, msg);
          } catch (msgErr: any) {
            logger.error('Error handling incoming WhatsApp message', { error: msgErr?.message });
          }
        }
      });

      return this.getSessionState(accountId);
    } catch (err: any) {
      session.status = 'error';
      session.lastError = err?.message || 'فشل تهيئة جلسة واتساب';
      logger.error('Failed to start Baileys session', { accountId, error: err?.message });
      await CrmSyncService.updateAccountStatus(accountId, 'error', {
        errorMessage: session.lastError || undefined,
      });
      return this.getSessionState(accountId);
    }
  }

  /**
   * Process individual incoming message
   */
  private static async processIncomingMessage(accountId: string, msg: WAMessage): Promise<void> {
    // Skip if outbound message sent by user
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid || '';

    // Ignore status broadcasts
    if (jid.includes('@broadcast') || jid === 'status@broadcast') return;

    // Sender phone number
    const cleanPhone = '+' + (jid.replace(/@.+/, '').replace(/[^\d]/g, ''));
    if (!cleanPhone || cleanPhone === '+') return;

    const senderName = msg.pushName || '';
    const externalMessageId = msg.key.id || `wa_${Date.now()}`;
    const timestamp = (Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000;

    const contentObj = msg.message;
    if (!contentObj) return;

    let textContent = '';
    let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';
    let mediaInfo = null;

    if (contentObj.conversation) {
      textContent = contentObj.conversation;
      messageType = 'text';
    } else if (contentObj.extendedTextMessage?.text) {
      textContent = contentObj.extendedTextMessage.text;
      messageType = 'text';
    } else if (contentObj.imageMessage) {
      textContent = contentObj.imageMessage.caption || '';
      messageType = 'image';
      mediaInfo = await MediaService.saveIncomingMedia(msg, 'image');
    } else if (contentObj.videoMessage) {
      textContent = contentObj.videoMessage.caption || '';
      messageType = 'video';
      mediaInfo = await MediaService.saveIncomingMedia(msg, 'video');
    } else if (contentObj.audioMessage) {
      textContent = contentObj.audioMessage.ptt ? 'رسالة صوتية' : 'مقطع صوتي';
      messageType = 'audio';
      mediaInfo = await MediaService.saveIncomingMedia(msg, 'audio');
    } else if (contentObj.documentMessage) {
      textContent = contentObj.documentMessage.fileName || 'مستند';
      messageType = 'document';
      mediaInfo = await MediaService.saveIncomingMedia(msg, 'document');
    }

    if (!textContent && !mediaInfo) {
      // Unknown or unsupported message payload (reaction, poll, etc.)
      return;
    }

    logger.info('Inbound WhatsApp message received', {
      accountId,
      from: cleanPhone,
      messageType,
      hasMedia: Boolean(mediaInfo),
    });

    await CrmSyncService.syncInboundMessage({
      accountId,
      senderPhone: cleanPhone,
      senderName,
      externalMessageId,
      content: textContent,
      messageType,
      media: mediaInfo,
      timestamp,
    });
  }

  /**
   * Outbound message sender
   */
  static async sendOutboundMessage(
    accountId: string,
    recipientPhone: string,
    content: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document'
  ): Promise<{ success: boolean; externalMessageId?: string; error?: string }> {
    const session = this.sessions.get(accountId);

    if (!session || session.status !== 'connected' || !session.socket) {
      return {
        success: false,
        error: `حساب واتساب (${accountId}) غير متصل حالياً`,
      };
    }

    try {
      // Normalize recipient phone to JID
      const cleanDigits = recipientPhone.replace(/[^\d]/g, '');
      const jid = `${cleanDigits}@s.whatsapp.net`;

      let sentMsg;

      if (mediaUrl && mediaType) {
        // If media URL is local uploads path
        let filePath: string | null = null;
        if (mediaUrl.startsWith('/uploads/')) {
          filePath = path.join(CONFIG.UPLOADS_DIR, mediaUrl.replace('/uploads/', ''));
        }

        if (filePath && fs.existsSync(filePath)) {
          const buffer = await fs.promises.readFile(filePath);
          if (mediaType === 'image') {
            sentMsg = await session.socket.sendMessage(jid, { image: buffer, caption: content || '' });
          } else if (mediaType === 'document') {
            sentMsg = await session.socket.sendMessage(jid, {
              document: buffer,
              mimetype: 'application/pdf',
              fileName: path.basename(filePath),
              caption: content || '',
            });
          } else if (mediaType === 'audio') {
            sentMsg = await session.socket.sendMessage(jid, { audio: buffer, ptt: true });
          } else {
            sentMsg = await session.socket.sendMessage(jid, { text: content });
          }
        } else {
          // Send external URL as media or text
          sentMsg = await session.socket.sendMessage(jid, { text: `${content}\n${mediaUrl}`.trim() });
        }
      } else {
        // Send pure text
        sentMsg = await session.socket.sendMessage(jid, { text: content });
      }

      const externalMessageId = sentMsg?.key?.id || `out_${Date.now()}`;

      logger.info('Outbound message sent successfully', {
        accountId,
        to: cleanDigits,
        externalMessageId,
      });

      return {
        success: true,
        externalMessageId,
      };
    } catch (err: any) {
      logger.error('Failed to send outbound WhatsApp message', {
        accountId,
        error: err?.message,
      });
      return {
        success: false,
        error: err?.message || 'فشل إرسال الرسالة عبر واتساب',
      };
    }
  }

  /**
   * Disconnect or remove session
   */
  static async disconnectSession(accountId: string, purgeCredentials = false): Promise<void> {
    const session = this.sessions.get(accountId);
    if (!session) return;

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    if (session.socket) {
      try {
        await session.socket.logout().catch(() => {});
        session.socket.end(undefined);
      } catch (err: any) {
        logger.warn('Error during socket termination', { error: err?.message });
      }
      session.socket = null;
    }

    session.status = 'disconnected';
    session.qrCodeDataUrl = null;
    session.qrRaw = null;
    session.reconnectAttempts = 0;

    if (purgeCredentials) {
      const sessionAuthPath = path.join(CONFIG.SESSIONS_DIR, accountId);
      try {
        if (fs.existsSync(sessionAuthPath)) {
          fs.rmSync(sessionAuthPath, { recursive: true, force: true });
        }
      } catch (rmErr: any) {
        logger.warn('Error deleting credentials directory', { error: rmErr?.message });
      }
    }

    await CrmSyncService.updateAccountStatus(accountId, 'disconnected');
  }

  /**
   * Get public state for a session
   */
  static getSessionState(accountId: string): SessionState {
    const session = this.sessions.get(accountId);
    if (!session) {
      return {
        accountId,
        status: 'disconnected',
        qrCodeDataUrl: null,
        qrRaw: null,
        qrGeneratedAt: null,
        phoneNumber: null,
        reconnectAttempts: 0,
        lastError: null,
      };
    }

    return {
      accountId: session.accountId,
      status: session.status,
      qrCodeDataUrl: session.qrCodeDataUrl,
      qrRaw: session.qrRaw,
      qrGeneratedAt: session.qrGeneratedAt,
      phoneNumber: session.phoneNumber,
      reconnectAttempts: session.reconnectAttempts,
      lastError: session.lastError,
    };
  }

  /**
   * List all current sessions
   */
  static getAllSessions(): SessionState[] {
    return Array.from(this.sessions.keys()).map((id) => this.getSessionState(id));
  }
}
