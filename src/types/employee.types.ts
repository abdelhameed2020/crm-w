import type { UserRole } from './auth.types';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
  isOnline: boolean;
  activeConversationsCount: number;
  maxActiveChats: number;
  assignedChannels: string[]; // IDs of channels this employee handles
  createdAt: number;
  lastActiveAt?: number;
}
