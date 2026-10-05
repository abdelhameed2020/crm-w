import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult
} from '../../../types/channel.types';

/**
 * Website Live Chat Provider Architecture Skeleton.
 */
export class WebsiteChatProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'website';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.identifier) {
      throw new Error('Website Widget App ID is required.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    return {
      isHealthy: account.status === 'connected',
      details: account.status === 'connected' ? 'Website Widget Active' : 'Inactive',
    };
  }

  async sendMessage(
    _account: ChannelAccount,
    _payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    return {
      success: true,
      externalMessageId: `web_${Date.now()}_mock_contract`,
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
