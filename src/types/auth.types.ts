import type { User as FirebaseUser } from 'firebase/auth';

export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserPermission {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewAllConversations: boolean;
  canAssignConversations: boolean;
  canDeleteConversations: boolean;
  canExportReports: boolean;
  canManageChannels: boolean;
  canManagePipelines: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  permissions?: Partial<UserPermission>;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}
