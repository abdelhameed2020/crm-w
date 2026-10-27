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
   * Resolve real phone number from JID or LID
   */
  static async resolvePhoneNumber(
    accountId: string,
    jid: string,
    participant?: string | null
  ): Promise<string> {
    const session = this.sessions.get(accountId);

    // 1. If standard phone number JID (...@s.whatsapp.net), user digits ARE phone number
    if (jid.endsWith('@s.whatsapp.net')) {
      const raw = jid.replace('@s.whatsapp.net', '').replace(/[^\d]/g, '');
      return `+${raw}`;
    }

    // 2. If LID or long identity string
    const lid = jid.replace(/@.+/, '').replace(/[^\d]/g, '');
    if (jid.includes('@lid') || lid.length > 13) {
      // A. Check Baileys internal signalRepository LID mapping
      try {
        if ((session?.socket as any)?.signalRepository?.lidMapping?.getPNForLID) {
          const pn = await (session!.socket as any).signalRepository.lidMapping.getPNForLID(lid);
          if (pn) {
            const clean = String(pn).replace(/[^\d]/g, '');
            logger.info('Resolved phone number via Baileys lidMapping store', { lid, pn: clean });
            return `+${clean}`;
          }
        }
      } catch (e) {
        // continue
      }

      // B. Check session folder for reverse mapping file (lid-mapping-{lid}_reverse.json)
      try {
        const revPath = path.join(CONFIG.SESSIONS_DIR, accountId, `lid-mapping-${lid}_reverse.json`);
        if (fs.existsSync(revPath)) {
          const raw = fs.readFileSync(revPath, 'utf8');
          const clean = JSON.parse(raw).replace(/[^\d]/g, '');
          if (clean) {
            logger.info('Resolved phone number from reverse mapping file', { lid, pn: clean });
            return `+${clean}`;
          }
        }
      } catch (e) {
        // continue
      }

      // C. Check participant if participant has @s.whatsapp.net
      if (participant && participant.endsWith('@s.whatsapp.net')) {
        const raw = participant.replace('@s.whatsapp.net', '').replace(/[^\d]/g, '');
        if (raw) return `+${raw}`;
      }

      // D. Try scanning all lid-mapping files in session directory
      try {
        const sessionDir = path.join(CONFIG.SESSIONS_DIR, accountId);
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir);
          const matched = files.find((f) => f.startsWith('lid-mapping-') && f.includes(lid) && f.endsWith('_reverse.json'));
          if (matched) {
            const raw = fs.readFileSync(path.join(sessionDir, matched), 'utf8');
            const clean = JSON.parse(raw).replace(/[^\d]/g, '');
            if (clean) return `+${clean}`;
          }
        }
      } catch (e) {
        // continue
      }

      return `+${lid}`;
    }

    const raw = jid.replace(/@.+/, '').replace(/[^\d]/g, '');
    return `+${raw}`;
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
    const cleanPhone = await this.resolvePhoneNumber(accountId, jid, msg.key.participant);
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

    // Extract Quoted Message context if this message is a reply to another
    const contextInfo =
      contentObj.extendedTextMessage?.contextInfo ||
      contentObj.imageMessage?.contextInfo ||
      contentObj.videoMessage?.contextInfo ||
      contentObj.documentMessage?.contextInfo;

    let quotedContext: { text: string; sender?: string } | undefined = undefined;
    if (contextInfo?.quotedMessage) {
      const q = contextInfo.quotedMessage;
      const qText =
        q.conversation ||
        q.extendedTextMessage?.text ||
        q.imageMessage?.caption ||
        (q.imageMessage ? '[صورة]' : '') ||
        (q.documentMessage ? `[ملف ${q.documentMessage.fileName || 'مستند'}]` : '');

      let qSender = contextInfo.participant || '';
      if (qSender) {
        const qDigits = qSender.replace(/@.+/, '').replace(/[^\d]/g, '');
        qSender = `+${qDigits}`;
      }

      if (qText) {
        quotedContext = {
          text: qText,
          sender: qSender || 'رسالة سابقة',
        };
      }
    }

    logger.info('Inbound WhatsApp message received', {
      accountId,
      from: cleanPhone,
      messageType,
      hasMedia: Boolean(mediaInfo),
      hasQuoted: Boolean(quotedContext),
    });

    await CrmSyncService.syncInboundMessage({
      accountId,
      senderPhone: cleanPhone,
      senderName,
      externalMessageId,
      content: textContent,
      messageType,
      media: mediaInfo,
      quoted: quotedContext,
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
    mediaType?: 'image' | 'video' | 'audio' | 'document',
    mediaBase64?: string,
    fileName?: string,
    mimeType?: string
  ): Promise<{ success: boolean; externalMessageId?: string; mediaUrl?: string; error?: string }> {
    // 1. Session resolution with fallback
    let session = this.sessions.get(accountId);
    if (!session || session.status !== 'connected' || !session.socket) {
      session = Array.from(this.sessions.values()).find((s) => s.status === 'connected' && s.socket);
    }

    if (!session || !session.socket) {
      return {
        success: false,
        error: `حساب واتساب (${accountId}) غير متصل حالياً`,
      };
    }

    try {
      // 2. Recipient phone normalization and LID resolution
      let cleanDigits = recipientPhone.replace(/[^\d]/g, '');

      if (cleanDigits.length > 13) {
        const resolved = await this.resolvePhoneNumber(session.accountId, `${cleanDigits}@lid`);
        if (resolved && resolved !== `+${cleanDigits}`) {
          cleanDigits = resolved.replace(/[^\d]/g, '');
          logger.info('Resolved recipient LID to real phone for outbound sending', {
            recipientPhone,
            resolvedPhone: cleanDigits,
          });
        }
      }

      // Check on WhatsApp for verified JID
      let jid = `${cleanDigits}@s.whatsapp.net`;
      try {
        const checkResults = await session.socket.onWhatsApp(cleanDigits);
        if (checkResults && checkResults.length > 0 && checkResults[0].jid) {
          jid = checkResults[0].jid;
          logger.info('Verified WhatsApp destination JID', { jid });
        }
      } catch (onWaErr: any) {
        logger.debug('onWhatsApp check skipped or failed, using standard JID', { error: onWaErr?.message });
      }

      let sentMsg;
      let returnedMediaUrl = mediaUrl;

      // 3. Handle outbound media (Base64 or URL)
      if (mediaBase64) {
        const saved = await MediaService.saveUpload(mediaBase64, fileName, mimeType);
        returnedMediaUrl = saved.publicUrl;
        const buffer = await fs.promises.readFile(saved.filePath);

        const mType = mediaType || (saved.mimeType.startsWith('image/') ? 'image' : 'document');
        if (mType === 'image') {
          sentMsg = await session.socket.sendMessage(jid, { image: buffer, caption: content || '' });
        } else if (mType === 'video') {
          sentMsg = await session.socket.sendMessage(jid, { video: buffer, caption: content || '' });
        } else if (mType === 'audio') {
          sentMsg = await session.socket.sendMessage(jid, { audio: buffer, ptt: true });
        } else {
          sentMsg = await session.socket.sendMessage(jid, {
            document: buffer,
            mimetype: saved.mimeType || 'application/octet-stream',
            fileName: fileName || saved.fileName,
            caption: content || '',
          });
        }
      } else if (mediaUrl && mediaType) {
        let filePath: string | null = null;
        if (mediaUrl.includes('/uploads/')) {
          const uploadFileName = mediaUrl.split('/uploads/')[1];
          filePath = path.join(CONFIG.UPLOADS_DIR, uploadFileName);
        }

        if (filePath && fs.existsSync(filePath)) {
          const buffer = await fs.promises.readFile(filePath);
          if (mediaType === 'image') {
            sentMsg = await session.socket.sendMessage(jid, { image: buffer, caption: content || '' });
          } else if (mediaType === 'video') {
            sentMsg = await session.socket.sendMessage(jid, { video: buffer, caption: content || '' });
          } else if (mediaType === 'document') {
            sentMsg = await session.socket.sendMessage(jid, {
              document: buffer,
              mimetype: mimeType || 'application/pdf',
              fileName: fileName || path.basename(filePath),
              caption: content || '',
            });
          } else if (mediaType === 'audio') {
            sentMsg = await session.socket.sendMessage(jid, { audio: buffer, ptt: true });
          } else {
            sentMsg = await session.socket.sendMessage(jid, { text: content });
          }
        } else {
          // Send external URL as text fallback
          sentMsg = await session.socket.sendMessage(jid, { text: `${content}\n${mediaUrl}`.trim() });
        }
      } else {
        // Send pure text
        sentMsg = await session.socket.sendMessage(jid, { text: content });
      }

      const externalMessageId = sentMsg?.key?.id || `out_${Date.now()}`;

      logger.info('Outbound message sent successfully', {
        accountId: session.accountId,
        to: jid,
        externalMessageId,
      });

      return {
        success: true,
        externalMessageId,
        mediaUrl: returnedMediaUrl,
      };
    } catch (err: any) {
      logger.error('Failed to send outbound WhatsApp message', {
        accountId: session.accountId,
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
