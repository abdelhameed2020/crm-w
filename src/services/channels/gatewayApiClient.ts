import type {
  WhatsAppSessionQrResponse,
  WhatsAppOutboundPayload,
  WhatsAppOutboundResult,
} from '../../types/whatsapp.types';
import { auth } from '../firebase/config';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5001';
const GATEWAY_API_KEY = import.meta.env.VITE_GATEWAY_API_KEY || '';

export class GatewayApiClient {
  private static async getHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          return headers;
        }
      }
    } catch {
      // Fallback
    }

    if (GATEWAY_API_KEY) {
      headers['x-gateway-key'] = GATEWAY_API_KEY;
    }
    return headers;
  }

  /**
   * Check overall Gateway service health
   */
  static async checkHealth(): Promise<{ isOnline: boolean; version?: string; activeSessions?: number; error?: string }> {
    try {
      const response = await fetch(`${GATEWAY_URL}/health`, {
        headers: await this.getHeaders(),
      });
      if (!response.ok) {
        return { isOnline: false, error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      return { isOnline: true, ...data };
    } catch (err: unknown) {
      return { isOnline: false, error: err instanceof Error ? err.message : 'Gateway unreachable' };
    }
  }

  /**
   * Initialize a WhatsApp Web session on the Gateway
   */
  static async initializeSession(accountId: string): Promise<WhatsAppSessionQrResponse> {
    const response = await fetch(`${GATEWAY_URL}/api/accounts/initialize`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ accountId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to initialize session' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch current QR Code data URL and connection status
   */
  static async getQrStatus(accountId: string): Promise<WhatsAppSessionQrResponse> {
    const response = await fetch(`${GATEWAY_URL}/api/accounts/${accountId}/qr`, {
      headers: await this.getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to get QR status' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Disconnect WhatsApp session
   */
  static async disconnectSession(accountId: string, clearSession = false): Promise<{ success: boolean }> {
    const response = await fetch(`${GATEWAY_URL}/api/accounts/${accountId}/disconnect`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ clearSession }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to disconnect session' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Reconnect WhatsApp session
   */
  static async reconnectSession(accountId: string): Promise<WhatsAppSessionQrResponse> {
    const response = await fetch(`${GATEWAY_URL}/api/accounts/${accountId}/reconnect`, {
      method: 'POST',
      headers: await this.getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to reconnect session' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Send outbound message via Gateway (Baileys Web)
   */
  static async sendMessage(payload: WhatsAppOutboundPayload): Promise<WhatsAppOutboundResult> {
    const response = await fetch(`${GATEWAY_URL}/api/messages/send`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to send WhatsApp message' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Send outbound message via Meta WhatsApp Cloud API (routed securely through Gateway)
   */
  static async sendCloudMessage(payload: WhatsAppOutboundPayload): Promise<WhatsAppOutboundResult> {
    const response = await fetch(`${GATEWAY_URL}/api/cloud/messages/send`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to send WhatsApp Cloud API message' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Fetch any pending inbound messages from Gateway sync queue
   */
  static async getPendingMessages(): Promise<any[]> {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/sync/pending`, {
        headers: await this.getHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.pending || [];
    } catch {
      return [];
    }
  }

  /**
   * Acknowledge messages that were successfully synced to Firestore
   */
  static async ackPendingMessages(messageIds: string[]): Promise<void> {
    try {
      await fetch(`${GATEWAY_URL}/api/sync/ack`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ messageIds }),
      });
    } catch (err) {
      console.warn('Failed acknowledging synced messages:', err);
    }
  }

  /**
   * Resolve LID or raw JID to verified phone number
   */
  static async resolvePhone(target: string, accountId = 'default'): Promise<string> {
    try {
      const cleanTarget = target.replace(/[^\d]/g, '');
      const response = await fetch(`${GATEWAY_URL}/api/accounts/${accountId}/resolve-phone/${encodeURIComponent(cleanTarget)}`, {
        headers: await this.getHeaders(),
      });
      if (!response.ok) return target;
      const data = await response.json();
      return data.phone || target;
    } catch {
      return target;
    }
  }

  /**
   * Upload media file to Gateway
   */
  static async uploadMedia(
    fileBase64: string,
    fileName?: string,
    mimeType?: string
  ): Promise<{ success: boolean; mediaUrl: string; fileName: string; mimeType: string }> {
    const response = await fetch(`${GATEWAY_URL}/api/media/upload`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ fileBase64, fileName, mimeType }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed uploading media' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }
}
