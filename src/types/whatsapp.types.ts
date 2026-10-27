export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'waiting_for_qr'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface WhatsAppAccount {
  id: string;
  displayName: string;
  phoneNumber?: string;
  status: WhatsAppConnectionStatus;
  provider: 'web' | 'cloud';
  assignedEmployees: string[]; // IDs of employees allowed to send from this account
  phoneNumberId?: string; // Meta Cloud API Phone Number ID
  wabaId?: string; // Meta WhatsApp Business Account ID
  lastConnectedAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WhatsAppSessionQrResponse {
  accountId: string;
  status: WhatsAppConnectionStatus;
  qrDataUrl?: string;
  phoneNumber?: string;
  error?: string;
}

export interface WhatsAppOutboundPayload {
  accountId: string;
  recipientPhone: string;
  content: string;
  provider?: 'web' | 'cloud';
  phoneNumberId?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  mediaBase64?: string;
  fileName?: string;
  mimeType?: string;
}

export interface WhatsAppOutboundResult {
  success: boolean;
  externalMessageId?: string;
  mediaUrl?: string;
  deliveredAt?: number;
  error?: string;
}
