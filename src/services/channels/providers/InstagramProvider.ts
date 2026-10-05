import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult
} from '../../../types/channel.types';

/**
 * Instagram Direct Provider Architecture Skeleton.
 */
export class InstagramProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'instagram';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.identifier) {
      throw new Error('Instagram Account ID is required.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    return {
      isHealthy: account.status === 'connected',
      details: account.status === 'connected' ? 'Instagram connected' : 'Disconnected',
    };
  }

  async sendMessage(
    _account: ChannelAccount,
    _payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    return {
      success: true,
      externalMessageId: `ig_${Date.now()}_mock_contract`,
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
