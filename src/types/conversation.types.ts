import type { ChannelType } from './channel.types';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';

export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AssignmentType =
  | 'auto_round_robin'
  | 'sticky_agent'
  | 'sla_escalation'
  | 'manual_admin'
  | 'manual_claim';

export interface Assignment {
  id?: string;
  previousEmployeeId?: string | null;
  previousEmployeeName?: string | null;
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
  assignedAt: number;
  reason?: string;
  assignmentType?: AssignmentType;
}

export type FirstResponseSlaStatus = 'pending' | 'responded' | 'breached';

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
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  lastMessageSnippet?: string;
  lastMessageTimestamp: number;
  lastMessageSenderType?: 'customer' | 'employee' | 'system' | 'bot';
  unreadCount: number;
  tags: string[];
  assignmentHistory?: Assignment[];

  // First Response SLA Tracking
  firstResponseDueAt?: number | null; // Deadline for first agent response
  firstResponseAt?: number | null; // Timestamp when first agent response was sent
  firstResponseSlaStatus?: FirstResponseSlaStatus; // 'pending' | 'responded' | 'breached'
  isFirstResponseDone?: boolean; // True once agent replies; protects from auto-reassignment

  // Sticky Agent & Substitute Tracking
  primaryOwnerId?: string | null; // Original customer agent
  primaryOwnerName?: string | null;
  isSubstitute?: boolean; // True if assigned to a substitute while primary is away/busy

  // Queue status if no agents are available
  queueStatus?: 'waiting_for_agent' | 'assigned';

  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}
