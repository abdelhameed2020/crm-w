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
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  fileName?: string;
}

export interface WhatsAppOutboundResult {
  success: boolean;
  externalMessageId?: string;
  deliveredAt?: number;
  error?: string;
}
