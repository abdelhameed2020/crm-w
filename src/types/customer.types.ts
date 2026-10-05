export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost';

export interface CustomerTag {
  id: string;
  name: string;
  color: string; // Hex color or Tailwind color class
}

export interface CustomerNote {
  id: string;
  customerId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
}

export type ActivityType =
  | 'status_change'
  | 'note_added'
  | 'tag_added'
  | 'conversation_started'
  | 'assignment_changed'
  | 'deal_created'
  | 'channel_connected';

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: ActivityType;
  description: string;
  performedBy: {
    id: string;
    name: string;
    role: string;
  };
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  leadStatus: LeadStatus;
  tags: string[]; // Tag IDs or tag names
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  sourceChannel: string; // The channel where the customer first arrived
  notesCount: number;
  dealsCount: number;
  dealsTotalValue: number;
  city?: string;
  country?: string;
  customFields?: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
  lastContactedAt?: number;
}
