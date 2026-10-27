import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import type { InboundMessagePayload } from './crm-sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../sessions');
const QUEUE_FILE = path.resolve(DATA_DIR, 'pending_messages.json');

export class SyncQueueService {
  private static queue: InboundMessagePayload[] = [];
  private static initialized = false;

  private static ensureLoaded(): void {
    if (this.initialized) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(QUEUE_FILE)) {
        const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
        this.queue = JSON.parse(raw);
      }
    } catch (err: any) {
      logger.warn('Failed loading pending messages queue from disk', { error: err?.message });
      this.queue = [];
    }
    this.initialized = true;
  }

  private static saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (err: any) {
      logger.warn('Failed persisting pending messages queue to disk', { error: err?.message });
    }
  }

  static addPendingMessage(payload: InboundMessagePayload): void {
    this.ensureLoaded();
    const exists = this.queue.some(
      (m) => m.externalMessageId === payload.externalMessageId
    );
    if (!exists) {
      this.queue.push(payload);
      this.saveToDisk();
      logger.info('Buffered inbound WhatsApp message into client sync queue', {
        sender: payload.senderPhone,
        messageId: payload.externalMessageId,
        totalPending: this.queue.length,
      });
    }
  }

  static getPendingMessages(): InboundMessagePayload[] {
    this.ensureLoaded();
    return [...this.queue];
  }

  static ackMessages(messageIds: string[]): void {
    this.ensureLoaded();
    if (!messageIds || messageIds.length === 0) return;
    const initialCount = this.queue.length;
    this.queue = this.queue.filter((m) => !messageIds.includes(m.externalMessageId));
    this.saveToDisk();
    logger.info('Acknowledged and removed synced WhatsApp messages', {
      ackedCount: initialCount - this.queue.length,
      remainingPending: this.queue.length,
    });
  }
}
