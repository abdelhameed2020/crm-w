import { where } from 'firebase/firestore';
import { GatewayApiClient } from './gatewayApiClient';
import { FirestoreService } from '../firebase/firestore.service';
import { COLLECTIONS } from '../firebase/collections';
import type { Customer } from '../../types/customer.types';
import type { Conversation } from '../../types/conversation.types';
import type { Message } from '../../types/message.types';
import type { Employee } from '../../types/employee.types';
import { isFirebaseConfigured } from '../firebase/config';
import { AutoAssignmentService } from '../assignment/AutoAssignmentService';

let isSyncing = false;

/**
 * Periodically polls WhatsApp Gateway for inbound messages that were buffered
 * and syncs them directly into Firestore using targeted queries.
 */
export async function processGatewaySync(): Promise<void> {
  if (isSyncing || !isFirebaseConfigured) return;
  isSyncing = true;

  try {
    const pending = await GatewayApiClient.getPendingMessages();
    if (!pending || pending.length === 0) return;

    const processedIds: string[] = [];

    for (const item of pending) {
      try {
        const rawPhone = item.senderPhone || '';
        let cleanPhone = '+' + rawPhone.replace(/[^\d]/g, '');
        if (cleanPhone.replace('+', '').length > 13) {
          const resolved = await GatewayApiClient.resolvePhone(cleanPhone);
          if (resolved && resolved !== cleanPhone) {
            cleanPhone = resolved;
          }
        }
        const phoneWithoutPlus = cleanPhone.replace('+', '');
        const customerName = item.senderName || `عميل واتساب (${cleanPhone})`;
        const targetAccountId = item.accountId || 'default';

        // 0. Message Idempotency Check (Prevent duplicate processing on webhook retries)
        const msgId = item.externalMessageId
          ? (item.externalMessageId.startsWith('msg_') ? item.externalMessageId : `msg_${item.externalMessageId}`)
          : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const existingMsg = await FirestoreService.getById<Message>(COLLECTIONS.MESSAGES, msgId);
        if (existingMsg) {
          processedIds.push(item.externalMessageId);
          continue;
        }

        // 1. Get or create Customer via fast targeted lookup
        let customerId = `cust_${phoneWithoutPlus}`;
        let matchedCustomer = await FirestoreService.getById<Customer>(COLLECTIONS.CUSTOMERS, customerId);

        if (matchedCustomer) {
          await FirestoreService.update<Customer>(COLLECTIONS.CUSTOMERS, customerId, {
            lastContactedAt: item.timestamp,
            updatedAt: Date.now(),
          });
        } else {
          const newCustomer: Customer = {
            id: customerId,
            name: customerName,
            phone: cleanPhone,
            leadStatus: 'new',
            tags: ['whatsapp'],
            sourceChannel: 'whatsapp',
            notesCount: 0,
            dealsCount: 0,
            dealsTotalValue: 0,
            createdAt: item.timestamp,
            updatedAt: item.timestamp,
            lastContactedAt: item.timestamp,
          };
          await FirestoreService.set<Customer>(COLLECTIONS.CUSTOMERS, customerId, newCustomer);
          matchedCustomer = newCustomer;
        }

        // 2. Get or create Conversation strictly scoped to the target account
        const existingConvs = await FirestoreService.list<Conversation>(
          COLLECTIONS.CONVERSATIONS,
          where('customerPhone', '==', cleanPhone)
        );
        const existingConv = existingConvs.find(
          (c) =>
            c.channel === 'whatsapp' &&
            c.status !== 'closed' &&
            (c.channelAccountId === targetAccountId || (!c.channelAccountId && targetAccountId === 'default'))
        );

        let convId = existingConv?.id;
        const snippet =
          item.content ||
          (item.messageType === 'image'
            ? '[صورة]'
            : item.messageType === 'video'
            ? '[فيديو]'
            : item.messageType === 'audio'
            ? '[رسالة صوتية]'
            : `[ملف ${item.messageType}]`);

        if (existingConv && convId) {
          let updateData: Partial<Conversation> = {
            lastMessageSnippet: snippet,
            lastMessageTimestamp: item.timestamp,
            lastMessageSenderType: 'customer',
            unreadCount: (existingConv.unreadCount || 0) + 1,
            updatedAt: Date.now(),
          };

          // If conversation has no assigned agent, attempt auto-assignment now
          if (!existingConv.assignedEmployeeId) {
            const decision = await AutoAssignmentService.decideAssignment(
              'whatsapp',
              matchedCustomer?.assignedEmployeeId || existingConv.primaryOwnerId,
              null,
              targetAccountId
            );
            if (decision.assigned && decision.agent) {
              const settings = await AutoAssignmentService.getSettings();
              const now = Date.now();
              const dueTime = now + settings.firstResponseTimeoutMinutes * 60 * 1000;
              updateData = {
                ...updateData,
                assignedEmployeeId: decision.agent.id,
                assignedEmployeeName: decision.agent.name,
                firstResponseDueAt: dueTime,
                firstResponseSlaStatus: 'pending',
                isFirstResponseDone: false,
                isSubstitute: decision.isSubstitute || false,
                primaryOwnerId: decision.primaryOwnerId || decision.agent.id,
                primaryOwnerName: decision.primaryOwnerName || decision.agent.name,
                queueStatus: 'assigned',
                assignmentHistory: [
                  ...(existingConv.assignmentHistory || []),
                  {
                    id: `asgn_${now}_${Math.random().toString(36).substring(2, 6)}`,
                    previousEmployeeId: null,
                    previousEmployeeName: null,
                    assignedToId: decision.agent.id,
                    assignedToName: decision.agent.name,
                    assignedById: 'system_auto_assignment',
                    assignedByName: 'نظام التوزيع التلقائي',
                    assignedAt: now,
                    reason: decision.reason,
                    assignmentType: decision.assignmentType || 'auto_round_robin',
                  },
                ],
              };
              const currentUnresponded = (decision.agent.activeUnrespondedChatsCount || 0) + 1;
              const currentActive = (decision.agent.activeConversationsCount || 0) + 1;
              const isNowBusy = currentUnresponded >= settings.maxUnrespondedChatsPerAgent;
              await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, decision.agent.id, {
                activeUnrespondedChatsCount: currentUnresponded,
                activeConversationsCount: currentActive,
                lastAssignedAt: now,
                ...(isNowBusy ? { status: 'busy' } : {}),
              });
            }
          }

          await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, convId, updateData);
        } else {
          convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const now = Date.now();
          const decision = await AutoAssignmentService.decideAssignment(
            'whatsapp',
            matchedCustomer?.assignedEmployeeId,
            null,
            targetAccountId
          );
          const settings = await AutoAssignmentService.getSettings();
          const dueTime = now + settings.firstResponseTimeoutMinutes * 60 * 1000;

          const newConv: Conversation = {
            id: convId,
            customerId,
            customerName: matchedCustomer?.name || customerName,
            customerPhone: cleanPhone,
            channel: 'whatsapp',
            channelAccountId: targetAccountId,
            status: 'open',
            priority: 'normal',
            unreadCount: 1,
            lastMessageSnippet: snippet,
            lastMessageTimestamp: item.timestamp,
            lastMessageSenderType: 'customer',
            tags: ['whatsapp'],
            createdAt: item.timestamp,
            updatedAt: item.timestamp,
            ...(decision.assigned && decision.agent
              ? {
                  assignedEmployeeId: decision.agent.id,
                  assignedEmployeeName: decision.agent.name,
                  firstResponseDueAt: dueTime,
                  firstResponseSlaStatus: 'pending',
                  isFirstResponseDone: false,
                  isSubstitute: decision.isSubstitute || false,
                  primaryOwnerId: decision.primaryOwnerId || decision.agent.id,
                  primaryOwnerName: decision.primaryOwnerName || decision.agent.name,
                  queueStatus: 'assigned',
                  assignmentHistory: [
                    {
                      id: `asgn_${now}_${Math.random().toString(36).substring(2, 6)}`,
                      previousEmployeeId: null,
                      previousEmployeeName: null,
                      assignedToId: decision.agent.id,
                      assignedToName: decision.agent.name,
                      assignedById: 'system_auto_assignment',
                      assignedByName: 'نظام التوزيع التلقائي',
                      assignedAt: now,
                      reason: decision.reason,
                      assignmentType: decision.assignmentType || 'auto_round_robin',
                    },
                  ],
                }
              : {
                  queueStatus: 'waiting_for_agent',
                  primaryOwnerId: decision.primaryOwnerId || null,
                  primaryOwnerName: decision.primaryOwnerName || null,
                }),
          };
          await FirestoreService.set<Conversation>(COLLECTIONS.CONVERSATIONS, convId, newConv);

          if (decision.assigned && decision.agent) {
            const currentUnresponded = (decision.agent.activeUnrespondedChatsCount || 0) + 1;
            const currentActive = (decision.agent.activeConversationsCount || 0) + 1;
            const isNowBusy = currentUnresponded >= settings.maxUnrespondedChatsPerAgent;
            await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, decision.agent.id, {
              activeUnrespondedChatsCount: currentUnresponded,
              activeConversationsCount: currentActive,
              lastAssignedAt: now,
              ...(isNowBusy ? { status: 'busy' } : {}),
            });

            if (customerId && (!matchedCustomer || !matchedCustomer.assignedEmployeeId)) {
              await FirestoreService.update<Customer>(COLLECTIONS.CUSTOMERS, customerId, {
                assignedEmployeeId: decision.agent.id,
                assignedEmployeeName: decision.agent.name,
                updatedAt: now,
              });
            }
          }
        }

        // 3. Create Message in Firestore
        const rawUrl = item.media?.publicUrl || item.media?.fileUrl || '';
        const fullMediaUrl = rawUrl ? (rawUrl.startsWith('/uploads/') ? `http://localhost:5001${rawUrl}` : rawUrl) : '';

        const mediaAttachment = fullMediaUrl
          ? [
              {
                url: fullMediaUrl,
                type: (item.messageType === 'image' || item.messageType === 'video' || item.messageType === 'audio')
                  ? item.messageType
                  : ('document' as const),
                fileName: item.media?.fileName,
                mimeType: item.media?.mimeType,
                fileSize: item.media?.fileSizeBytes,
              },
            ]
          : undefined;

        const newMsg: Message = {
          id: msgId,
          conversationId: convId,
          customerId,
          channel: 'whatsapp',
          senderType: 'customer',
          senderId: customerId,
          senderName: matchedCustomer?.name || customerName,
          content: snippet,
          messageType: item.messageType || 'text',
          mediaUrl: fullMediaUrl || undefined,
          ...(mediaAttachment ? { media: mediaAttachment } : {}),
          ...(item.quoted ? { metadata: { quoted: item.quoted } } : {}),
          status: 'delivered',
          timestamp: item.timestamp,
          externalMessageId: item.externalMessageId,
        };
        await FirestoreService.set<Message>(COLLECTIONS.MESSAGES, msgId, newMsg);

        processedIds.push(item.externalMessageId);
      } catch (itemErr) {
        console.error('Failed syncing inbound message item to Firestore:', itemErr);
      }
    }

    if (processedIds.length > 0) {
      await GatewayApiClient.ackPendingMessages(processedIds);
      console.log(`Successfully synced ${processedIds.length} WhatsApp messages into CRM Firestore`);
    }

    // Process any unassigned conversations in waiting queue
    try {
      await AutoAssignmentService.processWaitingQueue();
    } catch (queueErr) {
      console.warn('Queue processing error:', queueErr);
    }
  } catch (err) {
    console.warn('Gateway sync poll encountered error:', err);
  } finally {
    isSyncing = false;
  }
}
