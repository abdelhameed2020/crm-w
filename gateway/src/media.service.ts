import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import { CONFIG } from './config.js';
import { logger } from './logger.js';

// Ensure uploads directory exists
if (!fs.existsSync(CONFIG.UPLOADS_DIR)) {
  fs.mkdirSync(CONFIG.UPLOADS_DIR, { recursive: true });
}

export interface SavedMediaInfo {
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}

export class MediaService {
  /**
   * Downloads and saves media from an incoming Baileys WAMessage
   */
  static async saveIncomingMedia(
    message: WAMessage,
    mediaType: 'image' | 'video' | 'audio' | 'document'
  ): Promise<SavedMediaInfo | null> {
    try {
      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: undefined as any,
          reuploadRequest: () => Promise.resolve(undefined as any),
        }
      );

      if (!buffer || buffer.length === 0) {
        logger.warn('Downloaded media buffer is empty');
        return null;
      }

      // Determine extension and mimetype from message
      const msgContent = message.message;
      let ext = 'bin';
      let mimeType = 'application/octet-stream';

      if (mediaType === 'image' && msgContent?.imageMessage) {
        mimeType = msgContent.imageMessage.mimetype || 'image/jpeg';
        ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
      } else if (mediaType === 'video' && msgContent?.videoMessage) {
        mimeType = msgContent.videoMessage.mimetype || 'video/mp4';
        ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
      } else if (mediaType === 'audio' && msgContent?.audioMessage) {
        mimeType = msgContent.audioMessage.mimetype || 'audio/ogg';
        ext = msgContent.audioMessage.ptt ? 'ogg' : (mimeType.split('/')[1]?.split(';')[0] || 'mp3');
      } else if (mediaType === 'document' && msgContent?.documentMessage) {
        mimeType = msgContent.documentMessage.mimetype || 'application/octet-stream';
        const origName = msgContent.documentMessage.fileName;
        ext = origName ? path.extname(origName).replace('.', '') : 'pdf';
      }

      const randomSuffix = crypto.randomBytes(6).toString('hex');
      const fileName = `wa_${Date.now()}_${randomSuffix}.${ext}`;
      const filePath = path.join(CONFIG.UPLOADS_DIR, fileName);

      await fs.promises.writeFile(filePath, buffer);

      const publicUrl = `/uploads/${fileName}`;

      logger.info('Media saved successfully', {
        fileName,
        sizeBytes: buffer.length,
        mimeType,
      });

      return {
        fileName,
        filePath,
        publicUrl,
        mimeType,
        fileSizeBytes: buffer.length,
      };
    } catch (err: any) {
      logger.error('Failed to download/save WhatsApp media', {
        error: err?.message,
      });
      return null;
    }
  }

  /**
   * Save uploaded media from client (base64 string or data URL)
   */
  static async saveUpload(
    base64Data: string,
    originalName?: string,
    mimeType?: string
  ): Promise<SavedMediaInfo> {
    let cleanBase64 = base64Data;
    let detectedMime = mimeType || 'application/octet-stream';

    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      }
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    let ext = 'bin';

    if (detectedMime.includes('jpeg') || detectedMime.includes('jpg')) ext = 'jpg';
    else if (detectedMime.includes('png')) ext = 'png';
    else if (detectedMime.includes('webp')) ext = 'webp';
    else if (detectedMime.includes('gif')) ext = 'gif';
    else if (detectedMime.includes('pdf')) ext = 'pdf';
    else if (detectedMime.includes('mp4')) ext = 'mp4';
    else if (detectedMime.includes('ogg') || detectedMime.includes('audio')) ext = 'ogg';
    else if (originalName && path.extname(originalName)) ext = path.extname(originalName).replace('.', '');

    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const fileName = `out_${Date.now()}_${randomSuffix}.${ext}`;
    const filePath = path.join(CONFIG.UPLOADS_DIR, fileName);

    await fs.promises.writeFile(filePath, buffer);
    const publicUrl = `/uploads/${fileName}`;

    logger.info('Outbound media upload saved', {
      fileName,
      sizeBytes: buffer.length,
      mimeType: detectedMime,
    });

    return {
      fileName,
      filePath,
      publicUrl,
      mimeType: detectedMime,
      fileSizeBytes: buffer.length,
    };
  }
}
