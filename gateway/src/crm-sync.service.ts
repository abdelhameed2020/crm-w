import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { CONFIG } from './config.js';
import { logger } from './logger.js';
import type { SavedMediaInfo } from './media.service.js';
import { SyncQueueService } from './sync-queue.service.js';

let isInitialized = false;
let db: admin.firestore.Firestore | null = null;

function initFirebaseAdmin(): admin.firestore.Firestore | null {
  if (isInitialized && db) return db;

  try {
    // 1. Check custom path or default serviceAccountKey.json in gateway or root
    const keyCandidates = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), '../serviceAccountKey.json'),
    ].filter(Boolean) as string[];

    let serviceAccountLoaded = false;

    for (const keyPath of keyCandidates) {
      if (fs.existsSync(keyPath)) {
        try {
          const raw = fs.readFileSync(keyPath, 'utf8');
          const serviceAccount = JSON.parse(raw);
          if (!admin.apps.length) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id || CONFIG.FIREBASE_PROJECT_ID,
            });
          }
          serviceAccountLoaded = true;
          logger.info('Firebase Admin SDK initialized using serviceAccountKey.json', { path: keyPath });
          break;
        } catch (e: any) {
          logger.warn('Failed parsing serviceAccountKey file', { keyPath, error: e?.message });
        }
      }
    }

    // 2. Check JSON string in env var
    if (!serviceAccountLoaded && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || CONFIG.FIREBASE_PROJECT_ID,
          });
        }
        serviceAccountLoaded = true;
        logger.info('Firebase Admin SDK initialized using FIREBASE_SERVICE_ACCOUNT_KEY env var');
      } catch (e: any) {
        logger.warn('Failed parsing FIREBASE_SERVICE_ACCOUNT_KEY env var', { error: e?.message });
      }
    }

    // 3. Fallback to default application credentials or project ID
    if (!serviceAccountLoaded) {
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: CONFIG.FIREBASE_PROJECT_ID,
        });
      }
      logger.info('Firebase Admin SDK initialized with projectId fallback (Awaiting serviceAccountKey.json for full Firestore writes)', {
        projectId: CONFIG.FIREBASE_PROJECT_ID,
      });
    }

    db = admin.firestore();
    isInitialized = true;
    return db;
  } catch (err: any) {
    logger.warn('Firebase Admin SDK could not be fully initialized. Firestore sync will be skipped or buffered.', {
      error: err?.message,
    });
    return null;
  }
}

export interface InboundMessagePayload {
  accountId: string;
  senderPhone: string;
  senderName: string;
  externalMessageId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document';
  media?: SavedMediaInfo | null;
  quoted?: { text: string; sender?: string };
  timestamp: number;
}

export class CrmSyncService {
  /**
   * Updates WhatsApp account status in Firestore
   */
  static async updateAccountStatus(
    accountId: string,
    status: 'connected' | 'disconnected' | 'connecting' | 'qr_ready' | 'error',
    extra?: { phoneNumber?: string; errorMessage?: string }
  ): Promise<void> {
    const firestore = initFirebaseAdmin();
    if (!firestore) return;

    try {
      const docRef = firestore.collection('whatsappAccounts').doc(accountId);
      const updateData: Record<string, any> = {
        status,
        updatedAt: Date.now(),
      };

      if (status === 'connected') {
        updateData.lastConnectedAt = Date.now();
        if (extra?.phoneNumber) {
          updateData.phoneNumber = extra.phoneNumber;
        }
      }

      if (extra?.errorMessage) {
        updateData.lastErrorMessage = extra.errorMessage;
      }

      await docRef.set(updateData, { merge: true });
      logger.info('Synced account status to Firestore', { accountId, status });
    } catch (err: any) {
      logger.warn('Failed to sync account status to Firestore (check serviceAccountKey.json)', {
        accountId,
        error: err?.message,
      });
    }
  }

  /**
   * Syncs an inbound WhatsApp message to OmniCRM:
   * 1. Finds or creates Customer by phone number
   * 2. Finds or creates open Conversation for this customer & account
   * 3. Creates Message document in Firestore
   * 4. Updates Conversation snippet, unreadCount, and lastMessageTimestamp
   */
  static async syncInboundMessage(payload: InboundMessagePayload): Promise<void> {
    const firestore = initFirebaseAdmin();
    if (!firestore) {
      logger.warn('Skipping Firestore message sync (No Firestore connection configured), buffering for client sync', {
        sender: payload.senderPhone,
      });
      SyncQueueService.addPendingMessage(payload);
      return;
    }

    try {
      const cleanPhone = payload.senderPhone.replace(/[^\d+]/g, '');
      const customersRef = firestore.collection('customers');
      const conversationsRef = firestore.collection('conversations');
      const messagesRef = firestore.collection('messages');

      // 1. Find or create Customer
      let customerId: string;
      let customerName = payload.senderName || `عميل واتساب (${cleanPhone})`;

      const customerQuery = await customersRef
        .where('phone', '==', cleanPhone)
        .limit(1)
        .get();

      if (!customerQuery.empty) {
        const customerDoc = customerQuery.docs[0];
        customerId = customerDoc.id;
        const existingData = customerDoc.data();
        if (existingData.name && !payload.senderName) {
          customerName = existingData.name;
        }
        // Update last contacted
        await customerDoc.ref.update({
          lastContactedAt: payload.timestamp,
          updatedAt: Date.now(),
        });
      } else {
        // Create new customer
        const newCustomerRef = customersRef.doc();
        customerId = newCustomerRef.id;
        await newCustomerRef.set({
          id: customerId,
          name: customerName,
          phone: cleanPhone,
          leadStatus: 'new',
          tags: ['whatsapp'],
          sourceChannel: 'whatsapp',
          notesCount: 0,
          dealsCount: 0,
          dealsTotalValue: 0,
          createdAt: payload.timestamp,
          updatedAt: payload.timestamp,
          lastContactedAt: payload.timestamp,
        });
        logger.info('Auto-created new Customer from incoming WhatsApp message', {
          customerId,
          phone: cleanPhone,
        });
      }

      // 2. Find or create open Conversation scoped strictly to the WhatsApp Account
      let conversationId: string;
      const convQuery = await conversationsRef
        .where('customerId', '==', customerId)
        .where('channel', '==', 'whatsapp')
        .where('status', 'in', ['open', 'pending'])
        .get();

      const convDoc = convQuery.docs.find((doc) => {
        const d = doc.data();
        return d.channelAccountId === payload.accountId || (!d.channelAccountId && payload.accountId === 'default');
      });

      const lastSnippet = payload.content || (payload.messageType === 'image' ? '[صورة]' : `[ملف ${payload.messageType}]`);

      // 3. Message idempotency check
      const msgDocId = payload.externalMessageId
        ? (payload.externalMessageId.startsWith('msg_') ? payload.externalMessageId : `msg_${payload.externalMessageId}`)
        : messagesRef.doc().id;

      const existingMsgSnap = await messagesRef.doc(msgDocId).get();
      if (existingMsgSnap.exists) {
        logger.info('Inbound message already exists in Firestore (skipping duplicate webhook retry)', {
          externalMessageId: payload.externalMessageId,
        });
        return;
      }

      if (convDoc) {
        conversationId = convDoc.id;
        await convDoc.ref.update({
          lastMessageSnippet: lastSnippet,
          lastMessageTimestamp: payload.timestamp,
          lastMessageSenderType: 'customer',
          unreadCount: admin.firestore.FieldValue.increment(1),
          updatedAt: Date.now(),
        });
      } else {
        const newConvRef = conversationsRef.doc();
        conversationId = newConvRef.id;
        await newConvRef.set({
          id: conversationId,
          customerId,
          customerName,
          customerPhone: cleanPhone,
          channel: 'whatsapp',
          channelAccountId: payload.accountId,
          status: 'open',
          priority: 'normal',
          unreadCount: 1,
          lastMessageSnippet: lastSnippet,
          lastMessageTimestamp: payload.timestamp,
          lastMessageSenderType: 'customer',
          tags: ['whatsapp'],
          createdAt: payload.timestamp,
          updatedAt: payload.timestamp,
        });
        logger.info('Auto-created new Conversation for incoming WhatsApp message', {
          conversationId,
          customerId,
          channelAccountId: payload.accountId,
        });
      }

      // 4. Create Message document
      const newMessageRef = messagesRef.doc(msgDocId);
      const messageDoc: Record<string, any> = {
        id: newMessageRef.id,
        conversationId,
        customerId,
        channel: 'whatsapp',
        senderType: 'customer',
        senderId: customerId,
        senderName: customerName,
        content: payload.content || '',
        messageType: payload.messageType,
        status: 'delivered',
        timestamp: payload.timestamp,
        externalMessageId: payload.externalMessageId,
      };

      if (payload.media) {
        messageDoc.media = [
          {
            url: payload.media.publicUrl,
            type: payload.messageType,
            fileName: payload.media.fileName,
            mimeType: payload.media.mimeType,
            fileSize: payload.media.fileSizeBytes,
          },
        ];
      }

      await newMessageRef.set(messageDoc);

      logger.info('Successfully synced inbound message into Firestore', {
        messageId: newMessageRef.id,
        conversationId,
        customerId,
      });
    } catch (err: any) {
      logger.error('Failed to sync inbound message to Firestore, buffering for client sync', {
        error: err?.message,
        sender: payload.senderPhone,
      });
      SyncQueueService.addPendingMessage(payload);
    }
  }
}
