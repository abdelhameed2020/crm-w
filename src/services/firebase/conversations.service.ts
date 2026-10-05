import {
  orderBy,
  where,
  limit,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Conversation, ConversationStatus } from '../../types/conversation.types';
import type { ChannelType } from '../../types/channel.types';

export interface ConversationFilter {
  channel?: ChannelType;
  status?: ConversationStatus;
  assignedEmployeeId?: string;
  unassignedOnly?: boolean;
}

export class ConversationsService {
  /**
   * Realtime subscription to conversations list
   */
  static subscribeToConversations(
    filter: ConversationFilter | undefined,
    callback: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    if (filter?.channel) {
      constraints.push(where('channel', '==', filter.channel));
    }
    if (filter?.status) {
      constraints.push(where('status', '==', filter.status));
    }
    if (filter?.assignedEmployeeId) {
      constraints.push(where('assignedEmployeeId', '==', filter.assignedEmployeeId));
    }
    if (filter?.unassignedOnly) {
      constraints.push(where('assignedEmployeeId', '==', null));
    }

    constraints.push(orderBy('lastMessageTimestamp', 'desc'));
    constraints.push(limit(50));

    return FirestoreService.subscribe<Conversation>(
      COLLECTIONS.CONVERSATIONS,
      constraints,
      callback,
      onError
    );
  }

  /**
   * Get single conversation by ID
   */
  static async getConversation(conversationId: string): Promise<Conversation | null> {
    return FirestoreService.getById<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId);
  }

  /**
   * Update conversation status
   */
  static async updateStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      status,
      updatedAt: Date.now(),
    });
  }

  /**
   * Assign conversation to an employee
   */
  static async assignEmployee(
    conversationId: string,
    employeeId: string | undefined,
    employeeName: string | undefined,
    assignedById: string,
    assignedByName: string
  ): Promise<void> {
    const assignmentRecord = employeeId
      ? {
          assignedToId: employeeId,
          assignedToName: employeeName || '',
          assignedById,
          assignedByName,
          assignedAt: Date.now(),
        }
      : undefined;

    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      assignedEmployeeId: employeeId,
      assignedEmployeeName: employeeName,
      updatedAt: Date.now(),
      ...(assignmentRecord ? { assignmentHistory: [assignmentRecord] } : {}),
    });
  }

  /**
   * Mark conversation as read (reset unread count)
   */
  static async markAsRead(conversationId: string): Promise<void> {
    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      unreadCount: 0,
      updatedAt: Date.now(),
    });
  }
}
