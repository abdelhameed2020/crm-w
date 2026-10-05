export type ChannelType = 'whatsapp' | 'messenger' | 'instagram' | 'website';

export type ChannelStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface ChannelAccount {
  id: string;
  type: ChannelType;
  name: string;
  identifier: string; // Phone number for WhatsApp, Page ID for Messenger, Handle for Instagram, App ID for Website
  status: ChannelStatus;
  isActive: boolean;
  credentialsRef?: string; // Reference to secure backend secrets
  webhookUrl?: string;
  avatarUrl?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelMessagePayload {
  recipientId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  templateId?: string;
  templateParams?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ChannelDeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  deliveredAt?: number;
}
