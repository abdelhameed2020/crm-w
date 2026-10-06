import type {
  WhatsAppSessionQrResponse,
  WhatsAppOutboundPayload,
  WhatsAppOutboundResult,
} from '../../types/whatsapp.types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5001';
const GATEWAY_API_KEY = import.meta.env.VITE_GATEWAY_API_KEY || 'crm_gateway_secret_2026';

export class GatewayApiClient {
  private static getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-gateway-key': GATEWAY_API_KEY,
    };
  }

  /**
   * Check overall Gateway service health
   */
  static async checkHealth(): Promise<{ isOnline: boolean; version?: string; activeSessions?: number; error?: string }> {
    try {
      const response = await fetch(`${GATEWAY_URL}/health`, {
        headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to reconnect session' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Send outbound message via Gateway
   */
  static async sendMessage(payload: WhatsAppOutboundPayload): Promise<WhatsAppOutboundResult> {
    const response = await fetch(`${GATEWAY_URL}/api/messages/send`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to send WhatsApp message' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }
}
