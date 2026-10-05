import type {
  ChannelType,
  ChannelAccount,
  ChannelMessagePayload,
  ChannelDeliveryResult
} from '../../types/channel.types';

/**
 * Common Channel Provider Interface.
 * All communication channels (WhatsApp, Facebook Messenger, Instagram Direct, Website Chat, etc.)
 * must implement this contract to ensure the core CRM remains decoupled from specific APIs.
 */
export interface IChannelProvider {
  /**
   * The channel type handled by this provider
   */
  readonly channelType: ChannelType;

  /**
   * Initialize provider with account credentials
   */
  initialize(account: ChannelAccount): Promise<void>;

  /**
   * Verify provider connectivity / webhook status
   */
  checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }>;

  /**
   * Send outbound message through the provider's API
   */
  sendMessage(
    account: ChannelAccount,
    payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult>;

  /**
   * Parse inbound webhook payload into standardized message format
   */
  parseWebhookPayload(rawPayload: unknown): Promise<{
    externalMessageId: string;
    senderIdentifier: string;
    senderName?: string;
    content: string;
    messageType: string;
    timestamp: number;
    rawMetadata?: Record<string, unknown>;
  } | null>;
}
