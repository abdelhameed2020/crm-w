export interface AutoAssignmentSettings {
  enabled: boolean;
  method: 'round_robin' | 'least_active';
  firstResponseTimeoutMinutes: number; // default 2
  maxUnrespondedChatsPerAgent: number; // default 3
  stickyAgentEnabled: boolean; // default true
  heartbeatTimeoutSeconds: number; // default 90
  allowManagerAutoAssign: boolean; // default false
}

export interface OrganizationSettings {
  id: string;
  name: string;
  logoUrl?: string;
  defaultLanguage: 'ar' | 'en';
  timezone: string;
  workingHours: {
    start: string;
    end: string;
    workDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  };
  autoAssignment: AutoAssignmentSettings;
}

export interface SystemNotificationSettings {
  emailNotifications: boolean;
  browserNotifications: boolean;
  soundAlerts: boolean;
  notifyOnUnassigned: boolean;
}
