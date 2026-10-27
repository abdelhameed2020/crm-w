import { FirestoreService } from '../firebase/firestore.service';
import { COLLECTIONS } from '../firebase/collections';
import type { Conversation, Assignment } from '../../types/conversation.types';
import type { Employee } from '../../types/employee.types';
import { AutoAssignmentService } from './AutoAssignmentService';

export class SlaMonitorService {
  private static isChecking = false;

  /**
   * Scans conversations for breached First Response SLAs and escalates
   */
  static async checkAndEscalateBreachedConversations(
    onBreachEscalated?: (conv: Conversation, prevAgentName: string, newAgentName?: string) => void
  ): Promise<number> {
    if (this.isChecking) return 0;
    this.isChecking = true;

    let escalatedCount = 0;

    try {
      const now = Date.now();
      const conversations = await FirestoreService.list<Conversation>(COLLECTIONS.CONVERSATIONS);

      const breachedConversations = conversations.filter(
        (c) =>
          c.status === 'open' &&
          c.assignedEmployeeId &&
          !c.isFirstResponseDone &&
          c.firstResponseDueAt &&
          c.firstResponseDueAt <= now
      );

      for (const conv of breachedConversations) {
        const prevAgentId = conv.assignedEmployeeId!;
        const prevAgentName = conv.assignedEmployeeName || 'الموظف السابق';

        // 1. Relieve previous agent's unresponded counter
        const prevEmp = await FirestoreService.getById<Employee>(
          COLLECTIONS.EMPLOYEES,
          prevAgentId
        );
        if (prevEmp) {
          const updatedUnresponded = Math.max(
            0,
            (prevEmp.activeUnrespondedChatsCount || 1) - 1
          );
          const updatedActive = Math.max(
            0,
            (prevEmp.activeConversationsCount || 1) - 1
          );
          await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, prevAgentId, {
            activeUnrespondedChatsCount: updatedUnresponded,
            activeConversationsCount: updatedActive,
          });
        }

        // 2. Decide next eligible agent, strictly excluding previous breached agent
        const decision = await AutoAssignmentService.decideAssignment(conv.channel, null, prevAgentId);
        const settings = await AutoAssignmentService.getSettings();

        if (decision.assigned && decision.agent && decision.agent.id !== prevAgentId) {
          const newAgent = decision.agent;
          const dueTime = now + settings.firstResponseTimeoutMinutes * 60 * 1000;

          const escalationRecord: Assignment = {
            id: `asgn_esc_${now}_${Math.random().toString(36).substring(2, 6)}`,
            previousEmployeeId: prevAgentId,
            previousEmployeeName: prevAgentName,
            assignedToId: newAgent.id,
            assignedToName: newAgent.name,
            assignedById: 'system_sla_escalation',
            assignedByName: 'نظام تصعيد مهلة أول رد',
            assignedAt: now,
            reason: `إعادة توزيع تلقائي بسبب انقضاء مهلة أول رد (${settings.firstResponseTimeoutMinutes} دقائق) للموظف (${prevAgentName}) دون رد`,
            assignmentType: 'sla_escalation',
          };

          const existingHistory = conv.assignmentHistory || [];

          await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conv.id, {
            assignedEmployeeId: newAgent.id,
            assignedEmployeeName: newAgent.name,
            firstResponseDueAt: dueTime,
            firstResponseSlaStatus: 'pending',
            isFirstResponseDone: false,
            assignmentHistory: [...existingHistory, escalationRecord],
            updatedAt: now,
          });

          // Update new agent workload
          await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, newAgent.id, {
            activeUnrespondedChatsCount: (newAgent.activeUnrespondedChatsCount || 0) + 1,
            activeConversationsCount: (newAgent.activeConversationsCount || 0) + 1,
            lastAssignedAt: now,
          });

          if (onBreachEscalated) {
            onBreachEscalated(conv, prevAgentName, newAgent.name);
          }
          escalatedCount++;
        } else {
          // No substitute available, put in waiting queue
          const escalationRecord: Assignment = {
            id: `asgn_esc_${now}_${Math.random().toString(36).substring(2, 6)}`,
            previousEmployeeId: prevAgentId,
            previousEmployeeName: prevAgentName,
            assignedToId: '',
            assignedToName: '',
            assignedById: 'system_sla_escalation',
            assignedByName: 'نظام تصعيد مهلة أول رد',
            assignedAt: now,
            reason: `تجاوز مهلة أول رد للموظف (${prevAgentName})، وتم تحويل المحادثة إلى قائمة الانتظار لعدم توافر موظف بديل`,
            assignmentType: 'sla_escalation',
          };

          const existingHistory = conv.assignmentHistory || [];

          await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conv.id, {
            assignedEmployeeId: null,
            assignedEmployeeName: null,
            firstResponseSlaStatus: 'breached',
            queueStatus: 'waiting_for_agent',
            assignmentHistory: [...existingHistory, escalationRecord],
            updatedAt: now,
          });

          if (onBreachEscalated) {
            onBreachEscalated(conv, prevAgentName, undefined);
          }
          escalatedCount++;
        }
      }
    } catch (err) {
      console.error('Error running SLA monitor:', err);
    } finally {
      this.isChecking = false;
    }

    return escalatedCount;
  }
}
