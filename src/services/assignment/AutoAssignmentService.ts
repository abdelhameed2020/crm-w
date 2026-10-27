import { FirestoreService } from '../firebase/firestore.service';
import { COLLECTIONS } from '../firebase/collections';
import type { Employee } from '../../types/employee.types';
import type {
  Conversation,
  Assignment,
  AssignmentType,
} from '../../types/conversation.types';
import type { AutoAssignmentSettings } from '../../types/settings.types';
import type { WhatsAppAccount } from '../../types/whatsapp.types';

export const DEFAULT_ASSIGNMENT_SETTINGS: AutoAssignmentSettings = {
  enabled: true,
  method: 'round_robin',
  firstResponseTimeoutMinutes: 2,
  maxUnrespondedChatsPerAgent: 3,
  stickyAgentEnabled: true,
  heartbeatTimeoutSeconds: 90,
  allowManagerAutoAssign: false,
};

export interface AssignmentDecision {
  assigned: boolean;
  agent?: Employee | null;
  reason: string;
  assignmentType?: AssignmentType;
  isSubstitute?: boolean;
  primaryOwnerId?: string | null;
  primaryOwnerName?: string | null;
  isQueueFallback?: boolean;
}

export class AutoAssignmentService {
  /**
   * Load active auto-assignment settings from Firestore with local fallback
   */
  static async getSettings(): Promise<AutoAssignmentSettings> {
    try {
      const doc = await FirestoreService.getById<any>(COLLECTIONS.SETTINGS, 'auto_assignment');
      if (doc && doc.enabled !== undefined) {
        return {
          ...DEFAULT_ASSIGNMENT_SETTINGS,
          ...doc,
        };
      }
      const local = localStorage.getItem('omnicrm_auto_assignment_settings');
      if (local) {
        return {
          ...DEFAULT_ASSIGNMENT_SETTINGS,
          ...JSON.parse(local),
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ASSIGNMENT_SETTINGS;
  }

  /**
   * Save auto-assignment settings
   */
  static async saveSettings(settings: Partial<AutoAssignmentSettings>): Promise<void> {
    const updated = {
      ...DEFAULT_ASSIGNMENT_SETTINGS,
      ...settings,
    };
    await FirestoreService.set(COLLECTIONS.SETTINGS, 'auto_assignment', updated);
    localStorage.setItem('omnicrm_auto_assignment_settings', JSON.stringify(updated));
  }

  /**
   * Check if an agent is strictly eligible to receive new conversations
   */
  static isAgentEligible(
    employee: Employee,
    channel: string,
    settings: AutoAssignmentSettings,
    now = Date.now()
  ): { eligible: boolean; reason?: string } {
    // 1. Role filter (exclude managers/admins unless explicitly enabled)
    if (employee.role !== 'employee' && !settings.allowManagerAutoAssign) {
      return { eligible: false, reason: 'المستخدم مدير وليس موظف استقبال' };
    }

    // 2. Presence Status check
    const status = employee.status || (employee.isOnline ? 'available' : 'offline');
    if (status === 'away') {
      return { eligible: false, reason: 'الموظف في حالة استراحة (Away)' };
    }
    if (status === 'busy') {
      return { eligible: false, reason: 'الموظف في حالة انشغال (Busy)' };
    }
    if (status === 'offline') {
      return { eligible: false, reason: 'الموظف غير متصل (Offline)' };
    }

    // 3. Heartbeat Freshness check (must have sent a heartbeat within allowed window)
    if (employee.lastHeartbeatAt) {
      const elapsedSeconds = (now - employee.lastHeartbeatAt) / 1000;
      if (elapsedSeconds > settings.heartbeatTimeoutSeconds) {
        return {
          eligible: false,
          reason: `انقطعت نبضات الاتصال منذ ${Math.round(elapsedSeconds)} ثانية (أكثر من ${settings.heartbeatTimeoutSeconds}ث)`,
        };
      }
    }

    // 4. Assigned Channel filter (if employee has specific channels configured)
    if (
      employee.assignedChannels &&
      employee.assignedChannels.length > 0 &&
      !employee.assignedChannels.includes(channel) &&
      !employee.assignedChannels.includes('all')
    ) {
      return { eligible: false, reason: `الموظف غير مخصص لقناة ${channel}` };
    }

    // 5. Unresponded New Chats Threshold Check (Default 3)
    const unrespondedCount = employee.activeUnrespondedChatsCount || 0;
    if (unrespondedCount >= settings.maxUnrespondedChatsPerAgent) {
      return {
        eligible: false,
        reason: `تجاوز الحد الأقصى للمحادثات غير المردود عليها (${unrespondedCount}/${settings.maxUnrespondedChatsPerAgent})`,
      };
    }

    // 6. Hard limit on total active chats
    const activeCount = employee.activeConversationsCount || 0;
    const maxChats = employee.maxActiveChats || 10;
    if (activeCount >= maxChats) {
      return { eligible: false, reason: `بلغ الحد الأقصى الكلي للمحادثات (${activeCount}/${maxChats})` };
    }

    return { eligible: true };
  }

  /**
   * Determine the best eligible agent using Sticky Agent & Round Robin algorithms
   */
  static async decideAssignment(
    channel: string,
    customerPreviousAgentId?: string | null,
    excludeEmployeeId?: string | null,
    channelAccountId?: string | null
  ): Promise<AssignmentDecision> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      return {
        assigned: false,
        reason: 'نظام التوزيع التلقائي معطل في الإعدادات',
      };
    }

    let allEmployees = await FirestoreService.list<Employee>(COLLECTIONS.EMPLOYEES);
    if (!allEmployees || allEmployees.length === 0) {
      return {
        assigned: false,
        isQueueFallback: true,
        reason: 'لا يوجد أي موظف مسجل في النظام',
      };
    }

    // Account-level employee restriction: if channelAccountId is specified, filter by assignedEmployees
    if (channelAccountId && channelAccountId !== 'default') {
      try {
        const account = await FirestoreService.getById<WhatsAppAccount>(
          COLLECTIONS.WHATSAPP_ACCOUNTS,
          channelAccountId
        );
        if (account?.assignedEmployees && account.assignedEmployees.length > 0) {
          allEmployees = allEmployees.filter((emp) =>
            account.assignedEmployees?.includes(emp.id)
          );
        }
      } catch (e) {
        // Fall back to allEmployees
      }
    }

    const now = Date.now();

    // 1. Check Sticky Agent (Responsibility Continuity)
    if (settings.stickyAgentEnabled && customerPreviousAgentId && customerPreviousAgentId !== excludeEmployeeId) {
      const primaryAgent = allEmployees.find((e) => e.id === customerPreviousAgentId);
      if (primaryAgent && (!excludeEmployeeId || primaryAgent.id !== excludeEmployeeId)) {
        const eligibility = this.isAgentEligible(primaryAgent, channel, settings, now);
        if (eligibility.eligible) {
          return {
            assigned: true,
            agent: primaryAgent,
            assignmentType: 'sticky_agent',
            reason: `تم الإسناد للمسؤول السابق للعميل (${primaryAgent.name}) لتوافره`,
          };
        }
      }
    }

    // 2. Filter all eligible agents, strictly excluding the specified employee (e.g. breached SLA employee)
    const eligibleAgents = allEmployees.filter(
      (emp) =>
        (!excludeEmployeeId || (emp.id !== excludeEmployeeId && emp.email?.toLowerCase() !== excludeEmployeeId.toLowerCase())) &&
        this.isAgentEligible(emp, channel, settings, now).eligible
    );

    if (eligibleAgents.length === 0) {
      // Find primary agent name for substitute records if any
      const primaryAgent = customerPreviousAgentId
        ? allEmployees.find((e) => e.id === customerPreviousAgentId)
        : null;

      return {
        assigned: false,
        isQueueFallback: true,
        primaryOwnerId: primaryAgent?.id,
        primaryOwnerName: primaryAgent?.name,
        reason: 'لا يوجد أي موظف متاح حالياً (جميع الموظفين غير متصلين أو مشغولين أو بلغوا حد الـ 3 محادثات)',
      };
    }

    // 3. Fair Round Robin Sorting
    // Primary criterion: Agent who received an assignment longest ago (lastAssignedAt ASC)
    // Secondary criterion: Agent with fewest unresponded chats (least load)
    eligibleAgents.sort((a, b) => {
      const timeA = a.lastAssignedAt || 0;
      const timeB = b.lastAssignedAt || 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return (a.activeUnrespondedChatsCount || 0) - (b.activeUnrespondedChatsCount || 0);
    });

    const chosenAgent = eligibleAgents[0];
    const isSubstitute = Boolean(
      customerPreviousAgentId && customerPreviousAgentId !== chosenAgent.id
    );

    const primaryAgent = customerPreviousAgentId
      ? allEmployees.find((e) => e.id === customerPreviousAgentId)
      : null;

    return {
      assigned: true,
      agent: chosenAgent,
      assignmentType: isSubstitute ? 'sticky_agent' : 'auto_round_robin',
      isSubstitute,
      primaryOwnerId: primaryAgent?.id,
      primaryOwnerName: primaryAgent?.name,
      reason: isSubstitute
        ? `إسناد لموظف بديل (${chosenAgent.name}) لعدم توافر المسؤول الأصلي (${primaryAgent?.name || 'السابق'})`
        : `توزيع تلقائي عادل بنظام Round Robin على الموظف (${chosenAgent.name})`,
    };
  }

  /**
   * Execute atomic assignment on a conversation in Firestore
   */
  static async assignConversation(
    conversationId: string,
    decision: AssignmentDecision,
    settings?: AutoAssignmentSettings
  ): Promise<void> {
    const activeSettings = settings || (await this.getSettings());
    const now = Date.now();

    const conversation = await FirestoreService.getById<Conversation>(
      COLLECTIONS.CONVERSATIONS,
      conversationId
    );
    if (!conversation) return;

    if (!decision.assigned || !decision.agent) {
      // Mark as waiting in queue
      await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        queueStatus: 'waiting_for_agent',
        primaryOwnerId: decision.primaryOwnerId || conversation.primaryOwnerId || null,
        primaryOwnerName: decision.primaryOwnerName || conversation.primaryOwnerName || null,
        updatedAt: now,
      });
      return;
    }

    const agent = decision.agent;
    const dueTime = now + activeSettings.firstResponseTimeoutMinutes * 60 * 1000;

    const assignmentRecord: Assignment = {
      id: `asgn_${now}_${Math.random().toString(36).substring(2, 6)}`,
      previousEmployeeId: conversation.assignedEmployeeId || null,
      previousEmployeeName: conversation.assignedEmployeeName || null,
      assignedToId: agent.id,
      assignedToName: agent.name,
      assignedById: 'system_auto_assignment',
      assignedByName: 'نظام التوزيع التلقائي',
      assignedAt: now,
      reason: decision.reason,
      assignmentType: decision.assignmentType || 'auto_round_robin',
    };

    const existingHistory = conversation.assignmentHistory || [];

    // 1. Update Conversation document
    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      assignedEmployeeId: agent.id,
      assignedEmployeeName: agent.name,
      firstResponseDueAt: dueTime,
      firstResponseSlaStatus: 'pending',
      isFirstResponseDone: false,
      isSubstitute: decision.isSubstitute || false,
      primaryOwnerId: decision.primaryOwnerId || conversation.primaryOwnerId || agent.id,
      primaryOwnerName: decision.primaryOwnerName || conversation.primaryOwnerName || agent.name,
      queueStatus: 'assigned',
      assignmentHistory: [...existingHistory, assignmentRecord],
      updatedAt: now,
    });

    // 2. Update Employee Workload counters
    const currentUnresponded = (agent.activeUnrespondedChatsCount || 0) + 1;
    const currentActive = (agent.activeConversationsCount || 0) + 1;
    const isNowBusy = currentUnresponded >= activeSettings.maxUnrespondedChatsPerAgent;

    await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, agent.id, {
      activeUnrespondedChatsCount: currentUnresponded,
      activeConversationsCount: currentActive,
      lastAssignedAt: now,
      ...(isNowBusy ? { status: 'busy' } : {}),
    });
  }

  /**
   * Called when an agent replies to a customer for the first time.
   * Settles the First Response SLA, protects the conversation from auto-reassignment,
   * and decrements unresponded chat counter.
   */
  static async recordAgentFirstResponse(
    conversationId: string,
    employeeId: string
  ): Promise<void> {
    const conv = await FirestoreService.getById<Conversation>(
      COLLECTIONS.CONVERSATIONS,
      conversationId
    );
    if (!conv) return;

    // Requirement 8: If already responded, do nothing!
    if (conv.isFirstResponseDone) return;

    const now = Date.now();
    await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, {
      isFirstResponseDone: true,
      firstResponseAt: now,
      firstResponseSlaStatus: 'responded',
      updatedAt: now,
    });

    // Decrement employee's unresponded counter
    const emp = await FirestoreService.getById<Employee>(COLLECTIONS.EMPLOYEES, employeeId);
    if (emp) {
      const currentUnresponded = Math.max(0, (emp.activeUnrespondedChatsCount || 1) - 1);
      const settings = await this.getSettings();
      // If was busy due to threshold, restore to available
      const shouldRestoreAvailable =
        emp.status === 'busy' && currentUnresponded < settings.maxUnrespondedChatsPerAgent;

      await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, employeeId, {
        activeUnrespondedChatsCount: currentUnresponded,
        ...(shouldRestoreAvailable ? { status: 'available' } : {}),
      });
    }
  }

  /**
   * Process unassigned conversations in waiting queue (FIFO - oldest first)
   * Whenever an agent becomes available, or on sync cycles.
   */
  static async processWaitingQueue(): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.enabled) return 0;

    const convs = await FirestoreService.list<Conversation>(COLLECTIONS.CONVERSATIONS);
    const waitingConvs = convs
      .filter((c) => c.status !== 'closed' && (!c.assignedEmployeeId || c.queueStatus === 'waiting_for_agent'))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (waitingConvs.length === 0) return 0;

    let assignedCount = 0;
    for (const conv of waitingConvs) {
      const decision = await this.decideAssignment(
        conv.channel,
        conv.primaryOwnerId,
        null,
        conv.channelAccountId
      );
      if (decision.assigned && decision.agent) {
        await this.assignConversation(conv.id, decision, settings);
        assignedCount++;
      } else {
        // Still no agent available
        break;
      }
    }
    return assignedCount;
  }
}
