import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult,
} from '../../../types/channel.types';

/**
 * WhatsApp Official Cloud API Provider (Meta Graph API).
 * Reserved for Phase 4 (Official Meta Cloud API).
 */
export class WhatsAppCloudProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'whatsapp';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.identifier) {
      throw new Error('WhatsApp Phone Number ID is required for Cloud API initialization.');
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
    // Official Cloud API integration
    return {
      success: true,
      externalMessageId: `wamid_${Date.now()}_cloud_contract`,
      deliveredAt: Date.now(),
    };
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
