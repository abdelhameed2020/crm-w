import type { ChannelType, ChannelAccount, ChannelMessagePayload, ChannelDeliveryResult } from '../../types/channel.types';
import type { IChannelProvider } from './ChannelProvider.interface';
import { WhatsAppWebProvider } from './providers/WhatsAppWebProvider';
import { WhatsAppCloudProvider } from './providers/WhatsAppCloudProvider';
import { MessengerProvider } from './providers/MessengerProvider';
import { InstagramProvider } from './providers/InstagramProvider';
import { WebsiteChatProvider } from './providers/WebsiteChatProvider';

/**
 * Central Channel Manager with Strategy Pattern.
 * Supports swappable WhatsApp providers (Web vs Cloud) without modifying Core CRM.
 */
export class ChannelManager {
  private static instance: ChannelManager;
  private webProvider: WhatsAppWebProvider;
  private cloudProvider: WhatsAppCloudProvider;
  private providers: Map<ChannelType, IChannelProvider> = new Map();

  private constructor() {
    this.webProvider = new WhatsAppWebProvider();
    this.cloudProvider = new WhatsAppCloudProvider();

    this.registerProvider(this.webProvider);
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

  /**
   * Retrieves specific WhatsApp provider: 'web' (Baileys) or 'cloud' (Meta Cloud API)
   */
  public getWhatsAppProvider(providerType?: 'web' | 'cloud'): IChannelProvider {
    return providerType === 'cloud' ? this.cloudProvider : this.webProvider;
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
    if (account.type === 'whatsapp') {
      const providerType = (account.metadata?.provider as string) || (account as any).provider || 'web';
      const provider = this.getWhatsAppProvider(providerType === 'cloud' ? 'cloud' : 'web');
      return provider.sendMessage(account, payload);
    }
    const provider = this.getProvider(account.type);
    return provider.sendMessage(account, payload);
  }

  public async checkHealth(account: ChannelAccount): Promise<{ isHealthy: boolean; details?: string }> {
    if (account.type === 'whatsapp') {
      const providerType = (account.metadata?.provider as string) || (account as any).provider || 'web';
      const provider = this.getWhatsAppProvider(providerType === 'cloud' ? 'cloud' : 'web');
      return provider.checkHealth(account);
    }
    const provider = this.getProvider(account.type);
    return provider.checkHealth(account);
  }
}

export const channelManager = ChannelManager.getInstance();
