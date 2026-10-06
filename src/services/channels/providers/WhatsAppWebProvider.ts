import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult,
} from '../../../types/channel.types';
import { GatewayApiClient } from '../gatewayApiClient';

/**
 * WhatsApp Web Provider (Experimental Phase 3).
 * Connects Unified Inbox directly to WhatsApp Web Gateway without Meta Cloud API.
 * Swappable with WhatsAppCloudProvider when moving to official Meta API.
 */
export class WhatsAppWebProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'whatsapp';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.id) {
      throw new Error('Account ID is required for WhatsApp Web provider initialization.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    try {
      const gatewayHealth = await GatewayApiClient.checkHealth();
      if (!gatewayHealth.isOnline) {
        return { isHealthy: false, details: `Gateway Offline: ${gatewayHealth.error || 'غير متصل'}` };
      }
      return {
        isHealthy: account.status === 'connected',
        details: account.status === 'connected' ? 'WhatsApp Web متصل ونشط' : 'بانتظار مسح QR Code أو إعادة الاتصال',
      };
    } catch (err: unknown) {
      return {
        isHealthy: false,
        details: err instanceof Error ? err.message : 'فشل فحص حالة خادم البوابة',
      };
    }
  }

  async sendMessage(
    account: ChannelAccount,
    payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    try {
      const result = await GatewayApiClient.sendMessage({
        accountId: account.id,
        recipientPhone: payload.recipientId,
        content: payload.content,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
      });

      return {
        success: result.success,
        externalMessageId: result.externalMessageId,
        deliveredAt: result.deliveredAt || Date.now(),
        error: result.error,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'فشل إرسال الرسالة عبر WhatsApp Web Gateway',
      };
    }
  }

  async parseWebhookPayload(_rawPayload: unknown): Promise<{
    externalMessageId: string;
    senderIdentifier: string;
    senderName?: string;
    content: string;
    messageType: string;
    timestamp: number;
    rawMetadata?: Record<string, unknown>;
  } | null> {
    // WhatsApp Web Gateway pushes incoming messages directly into Firestore in realtime
    return null;
  }
}
