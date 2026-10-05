import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult
} from '../../../types/channel.types';

/**
 * WhatsApp Cloud API Provider Architecture Skeleton.
 * Ready for Cloud Functions / Backend integration in upcoming stages.
 * Direct Meta API calls are isolated from UI components.
 */
export class WhatsAppProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'whatsapp';

  async initialize(account: ChannelAccount): Promise<void> {
    // Architecture hook: validate token format, phone number ID, WABA ID
    if (!account.identifier) {
      throw new Error('WhatsApp Phone Number ID is required for initialization.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    return {
      isHealthy: account.status === 'connected',
      details: account.status === 'connected' ? 'WhatsApp Cloud API configured' : 'Disconnected',
    };
  }

  async sendMessage(
    _account: ChannelAccount,
    _payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    // Real API integration will be invoked via secure Firebase Cloud Function / Backend
    return {
      success: true,
      externalMessageId: `wamid_${Date.now()}_mock_contract`,
      deliveredAt: Date.now(),
    };
  }

  async parseWebhookPayload(rawPayload: unknown): Promise<{
    externalMessageId: string;
    senderIdentifier: string;
    senderName?: string;
    content: string;
    messageType: string;
    timestamp: number;
    rawMetadata?: Record<string, unknown>;
  } | null> {
    if (!rawPayload || typeof rawPayload !== 'object') {
      return null;
    }
    // Structure for WhatsApp Webhook parsing contract
    return null;
  }
}
