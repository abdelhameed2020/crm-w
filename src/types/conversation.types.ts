import type { ChannelType } from './channel.types';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';

export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Assignment {
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
  assignedAt: number;
  reason?: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAvatarUrl?: string;
  channel: ChannelType;
  channelAccountId: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  lastMessageSnippet?: string;
  lastMessageTimestamp: number;
  lastMessageSenderType?: 'customer' | 'employee' | 'system' | 'bot';
  unreadCount: number;
  tags: string[];
  assignmentHistory?: Assignment[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}
