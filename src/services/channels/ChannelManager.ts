import type { ChannelType, ChannelAccount, ChannelMessagePayload, ChannelDeliveryResult } from '../../types/channel.types';
import type { IChannelProvider } from './ChannelProvider.interface';
import { WhatsAppProvider } from './providers/WhatsAppProvider';
import { MessengerProvider } from './providers/MessengerProvider';
import { InstagramProvider } from './providers/InstagramProvider';
import { WebsiteChatProvider } from './providers/WebsiteChatProvider';

/**
 * Central Channel Manager.
 * Decouples CRM business logic from third-party APIs using the Strategy Pattern.
 */
export class ChannelManager {
  private static instance: ChannelManager;
  private providers: Map<ChannelType, IChannelProvider> = new Map();

  private constructor() {
    this.registerProvider(new WhatsAppProvider());
    this.registerProvider(new MessengerProvider());
    this.registerProvider(new InstagramProvider());
    this.registerProvider(new WebsiteChatProvider());
  }

  public static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager();
    }
    return ChannelManager.instance;
  }

  public registerProvider(provider: IChannelProvider): void {
    this.providers.set(provider.channelType, provider);
  }

  public getProvider(type: ChannelType): IChannelProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Channel provider for '${type}' is not registered.`);
    }
    return provider;
  }

  public async sendMessage(
    account: ChannelAccount,
    payload: ChannelMessagePayload
  ): Promise<ChannelDeliveryResult> {
    const provider = this.getProvider(account.type);
    return provider.sendMessage(account, payload);
  }

  public async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    const provider = this.getProvider(account.type);
    return provider.checkHealth(account);
  }
}

export const channelManager = ChannelManager.getInstance();
