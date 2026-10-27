import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult,
} from '../../../types/channel.types';
import { GatewayApiClient } from '../gatewayApiClient';

/**
 * WhatsApp Official Cloud API Provider (Meta Graph API).
 * Routes outbound messages through the secure Gateway to keep Meta secrets on the server.
 */
export class WhatsAppCloudProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'whatsapp';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.id) {
      throw new Error('WhatsApp Account ID is required for Cloud API initialization.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    return {
      isHealthy: account.status === 'connected',
      details: account.status === 'connected' ? 'WhatsApp Cloud API متصل وجاهز' : 'غير متصل أو بانتظار التهيئة',
    };
  }

  async sendMessage(
    account: ChannelAccount,
    payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    try {
      const phoneNumberId = (account.metadata?.phoneNumberId as string) || account.identifier;
      const result = await GatewayApiClient.sendCloudMessage({
        accountId: account.id,
        recipientPhone: payload.recipientId,
        content: payload.content,
        phoneNumberId,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        mediaBase64: payload.mediaBase64,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
      });

      return {
        success: result.success,
        externalMessageId: result.externalMessageId,
        mediaUrl: result.mediaUrl,
        deliveredAt: result.deliveredAt || Date.now(),
        error: result.error,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'فشل إرسال الرسالة عبر WhatsApp Cloud API',
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
    return null;
  }
}
