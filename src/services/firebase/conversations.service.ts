import {
  limit,
  where,
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
   * Realtime subscription to conversations list.
   * Uses server-side where constraints for assignedEmployeeId to enforce security rules
   * and client-side sorting/deduplication.
   */
  static subscribeToConversations(
    filter: ConversationFilter | undefined,
    callback: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    if (filter?.assignedEmployeeId) {
      constraints.push(where('assignedEmployeeId', '==', filter.assignedEmployeeId));
    }
    constraints.push(limit(150));

    return FirestoreService.subscribe<Conversation>(
      COLLECTIONS.CONVERSATIONS,
      constraints,
      (items) => {
        let result = [...items];

        if (filter?.channel && (filter.channel as string) !== 'all') {
          result = result.filter((c) => c.channel === filter.channel);
        }
        if (filter?.status && (filter.status as string) !== 'all') {
          result = result.filter((c) => c.status === filter.status);
        }
        if (filter?.assignedEmployeeId) {
          result = result.filter((c) => c.assignedEmployeeId === filter.assignedEmployeeId);
        }
        if (filter?.unassignedOnly) {
          result = result.filter((c) => !c.assignedEmployeeId || c.queueStatus === 'waiting_for_agent');
        }

        // Deduplicate conversations sharing the same phone and channel
        const deduplicatedMap = new Map<string, Conversation>();
        for (const conv of result) {
          const normPhone = (conv.customerPhone || '').replace(/[^\d]/g, '');
          const key = normPhone ? `${conv.channel}_${normPhone}` : conv.id;
          if (!deduplicatedMap.has(key)) {
            deduplicatedMap.set(key, conv);
          } else {
            const existing = deduplicatedMap.get(key)!;
            const timeA = conv.lastMessageTimestamp || conv.updatedAt || 0;
            const timeB = existing.lastMessageTimestamp || existing.updatedAt || 0;
            if (timeA > timeB) {
              deduplicatedMap.set(key, conv);
            }
          }
        }

        const finalResult = Array.from(deduplicatedMap.values());
        finalResult.sort((a, b) => {
          const timeA = a.lastMessageTimestamp || a.updatedAt || a.createdAt || 0;
          const timeB = b.lastMessageTimestamp || b.updatedAt || b.createdAt || 0;
          return timeB - timeA;
        });

        callback(finalResult);
      },
      onError
    );
  }

  /**
   * Create or overwrite a conversation
   */
  static async createConversation(conversation: Conversation): Promise<void> {
    await FirestoreService.set<Conversation>(COLLECTIONS.CONVERSATIONS, conversation.id, conversation);
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
    assignedByName: string,
    reason?: string
  ): Promise<void> {
    const existingConv = await FirestoreService.getById<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId);
    const prevHistory = existingConv?.assignmentHistory || [];
    const prevEmpId = existingConv?.assignedEmployeeId || null;
    const prevEmpName = existingConv?.assignedEmployeeName || null;

    const assignmentRecord = employeeId
      ? {
          id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          previousEmployeeId: prevEmpId,
          previousEmployeeName: prevEmpName,
          assignedToId: employeeId,
          assignedToName: employeeName || '',
          assignedById,
          assignedByName,
          assignedAt: Date.now(),
          reason: reason || (assignedById === employeeId ? 'استلام يدوي للمحادثة من قبل الموظف' : 'تحويل يدوي بواسطة المشرف/المدير'),
          assignmentType: (assignedById === employeeId ? 'manual_takeover' : 'manual_manager') as any,
        }
      : undefined;

    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      assignedEmployeeId: employeeId || null,
      assignedEmployeeName: employeeName || null,
      queueStatus: employeeId ? 'assigned' : 'waiting_for_agent',
      updatedAt: Date.now(),
      ...(assignmentRecord ? { assignmentHistory: [...prevHistory, assignmentRecord] } : {}),
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

  /**
   * Update conversation data partially
   */
  static async updateConversation(conversationId: string, data: Partial<Conversation>): Promise<void> {
    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      ...data,
      updatedAt: Date.now(),
    });
  }
}
