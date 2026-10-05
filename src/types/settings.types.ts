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
  autoAssignment: {
    enabled: boolean;
    method: 'round_robin' | 'least_active';
  };
}

export interface SystemNotificationSettings {
  emailNotifications: boolean;
  browserNotifications: boolean;
  soundAlerts: boolean;
  notifyOnUnassigned: boolean;
}
