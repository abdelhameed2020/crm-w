import type { IChannelProvider } from '../ChannelProvider.interface';
import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult
} from '../../../types/channel.types';

/**
 * Facebook Messenger Provider Architecture Skeleton.
 */
export class MessengerProvider implements IChannelProvider {
  readonly channelType: ChannelType = 'messenger';

  async initialize(account: ChannelAccount): Promise<void> {
    if (!account.identifier) {
      throw new Error('Facebook Page ID is required.');
    }
  }

  async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    return {
      isHealthy: account.status === 'connected',
      details: account.status === 'connected' ? 'Facebook Page connected' : 'Disconnected',
    };
  }

  async sendMessage(
    _account: ChannelAccount,
    _payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    return {
      success: true,
      externalMessageId: `mid_${Date.now()}_mock_contract`,
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
