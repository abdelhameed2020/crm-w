import {
  orderBy,
  where,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Message, MessageStatus } from '../../types/message.types';

export class MessagesService {
  /**
   * Subscribe in real-time to messages belonging to a conversation
   */
  static subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<Message>(
      COLLECTIONS.MESSAGES,
      [
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc'),
        limit(100),
      ],
      callback,
      onError
    );
  }

  /**
   * Send a new message record into Firestore
   */
  static async createMessage(message: Message): Promise<void> {
    await FirestoreService.set<Message>(COLLECTIONS.MESSAGES, message.id, message);

    // Also update conversation snippet and timestamp
    await FirestoreService.update(COLLECTIONS.CONVERSATIONS, message.conversationId, {
      lastMessageSnippet: message.content,
      lastMessageTimestamp: message.timestamp,
      lastMessageSenderType: message.senderType,
      updatedAt: Date.now(),
    });
  }

  /**
   * Update message delivery status
   */
  static async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    await FirestoreService.update<Message>(COLLECTIONS.MESSAGES, messageId, {
      status,
    });
  }
}
