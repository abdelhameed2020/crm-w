import type { UserRole } from './auth.types';

export type EmployeePresenceStatus = 'available' | 'busy' | 'away' | 'offline';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
  isOnline: boolean;
  status?: EmployeePresenceStatus;
  awayReason?: string;
  lastHeartbeatAt?: number;
  activeConversationsCount: number;
  activeUnrespondedChatsCount?: number; // Count of new assigned chats awaiting first response
  maxActiveChats: number;
  assignedChannels: string[]; // IDs of channels this employee handles
  createdAt: number;
  lastActiveAt?: number;
  lastAssignedAt?: number; // Timestamp of last assigned conversation for Round Robin sorting
}
