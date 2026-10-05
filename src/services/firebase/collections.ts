/**
 * Centralized Firestore Collection Names.
 * Ensures consistent collection naming across web client, cloud functions, and security rules.
 */
export const COLLECTIONS = {
  USERS: 'users',
  EMPLOYEES: 'employees',
  CUSTOMERS: 'customers',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  CHANNELS: 'channels',
  TAGS: 'tags',
  ACTIVITIES: 'activities',
  NOTES: 'notes',
  PIPELINES: 'pipelines',
  PIPELINE_STAGES: 'pipelineStages',
  ASSIGNMENTS: 'assignments',
  SETTINGS: 'settings',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
