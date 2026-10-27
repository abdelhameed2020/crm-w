import type { ChannelType } from './channel.types';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'sticker'
  | 'template'
  | 'system';

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type MessageSenderType =
  | 'customer'
  | 'employee'
  | 'system'
  | 'bot';

export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MediaAttachment {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
  fileSize?: number; // In bytes
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number; // Seconds for audio/video
}

export interface TemplatePayload {
  templateName: string;
  language: string;
  parameters?: Record<string, string>;
}

export interface Message {
  id: string;
  conversationId: string;
  customerId: string;
  channel: ChannelType;
  senderType: MessageSenderType;
  senderId: string;
  senderName?: string;
  content: string;
  messageType: MessageType;
  media?: MediaAttachment[];
  mediaUrl?: string;
  location?: LocationPayload;
  template?: TemplatePayload;
  status: MessageStatus;
  timestamp: number;
  externalMessageId?: string; // ID assigned by Meta / WhatsApp / Messenger
  replyToMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
