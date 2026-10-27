import {
  orderBy,
  where,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Customer, CustomerNote, CustomerActivity, LeadStatus } from '../../types/customer.types';

export class CustomersService {
  /**
   * Subscribe to customer list
   */
  static subscribeToCustomers(
    callback: (customers: Customer[]) => void,
    onError?: (error: Error) => void,
    maxLimit = 500
  ): Unsubscribe {
    return FirestoreService.subscribe<Customer>(
      COLLECTIONS.CUSTOMERS,
      [orderBy('updatedAt', 'desc'), limit(maxLimit)],
      callback,
      onError
    );
  }

  /**
   * Get single customer by ID
   */
  static async getCustomer(customerId: string): Promise<Customer | null> {
    return FirestoreService.getById<Customer>(COLLECTIONS.CUSTOMERS, customerId);
  }

  /**
   * Create or update customer
   */
  static async saveCustomer(customer: Customer): Promise<void> {
    await FirestoreService.set<Customer>(COLLECTIONS.CUSTOMERS, customer.id, customer);
  }

  /**
   * Update customer lead status
   */
  static async updateLeadStatus(customerId: string, status: LeadStatus): Promise<void> {
    await FirestoreService.update<Customer>(COLLECTIONS.CUSTOMERS, customerId, {
      leadStatus: status,
      updatedAt: Date.now(),
    });
  }

  /**
   * Add note to customer
   */
  static async addNote(note: CustomerNote): Promise<void> {
    await FirestoreService.set<CustomerNote>(COLLECTIONS.NOTES, note.id, note);
  }

  /**
   * Subscribe to customer internal notes
   */
  static subscribeToNotes(
    customerId: string,
    callback: (notes: CustomerNote[]) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<CustomerNote>(
      COLLECTIONS.NOTES,
      [where('customerId', '==', customerId), limit(50)],
      (items) => {
        const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
        callback(sorted);
      }
    );
  }

  /**
   * Delete customer by ID
   */
  static async deleteCustomer(customerId: string): Promise<void> {
    await FirestoreService.delete(COLLECTIONS.CUSTOMERS, customerId);
  }

  /**
   * Fetch all customers
   */
  static async listAllCustomers(): Promise<Customer[]> {
    return FirestoreService.list<Customer>(COLLECTIONS.CUSTOMERS);
  }

  /**
   * Batch import customers from parsed Excel rows with deduplication
   */
  static async importBatchCustomers(
    rows: Array<{
      name: string;
      phoneNormalized: string;
      phoneCleanDigits: string;
      email?: string;
      leadStatus: LeadStatus;
      sourceChannel: string;
      city?: string;
      tags: string[];
      notes?: string;
    }>,
    options: {
      overwriteExisting?: boolean;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<{ added: number; updated: number; skipped: number; failed: number }> {
    const { overwriteExisting = true, onProgress } = options;
    const existingCustomers = await this.listAllCustomers();
    const phoneMap = new Map<string, Customer>();

    existingCustomers.forEach((c) => {
      if (c.phone) {
        const clean = c.phone.replace(/[^\d]/g, '');
        phoneMap.set(clean, c);
      }
      phoneMap.set(c.id, c);
    });

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const total = rows.length;

    for (let i = 0; i < total; i++) {
      const row = rows[i];
      try {
        const now = Date.now();
        const customerId = row.phoneCleanDigits
          ? `cust_${row.phoneCleanDigits}`
          : `cust_import_${now}_${i}`;

        const existing = row.phoneCleanDigits
          ? phoneMap.get(row.phoneCleanDigits) || phoneMap.get(customerId)
          : undefined;

        if (existing) {
          if (!overwriteExisting) {
            skipped++;
            if (onProgress) onProgress(i + 1, total);
            continue;
          }

          // Merge tags
          const mergedTags = Array.from(new Set([...(existing.tags || []), ...row.tags]));

          const updatedCustomer: Customer = {
            ...existing,
            name: row.name || existing.name,
            email: row.email || existing.email,
            phone: row.phoneNormalized || existing.phone,
            leadStatus: row.leadStatus || existing.leadStatus,
            sourceChannel: existing.sourceChannel || row.sourceChannel,
            city: row.city || existing.city,
            tags: mergedTags,
            updatedAt: now,
          };

          await this.saveCustomer(updatedCustomer);
          phoneMap.set(row.phoneCleanDigits, updatedCustomer);
          updated++;
        } else {
          // New customer
          const newCustomer: Customer = {
            id: customerId,
            name: row.name,
            phone: row.phoneNormalized || undefined,
            email: row.email || undefined,
            leadStatus: row.leadStatus,
            sourceChannel: row.sourceChannel || 'excel_import',
            city: row.city,
            tags: row.tags,
            notesCount: row.notes ? 1 : 0,
            dealsCount: 0,
            dealsTotalValue: 0,
            createdAt: now,
            updatedAt: now,
          };

          await this.saveCustomer(newCustomer);

          // Save note if present
          if (row.notes) {
            await this.addNote({
              id: `note_${now}_${i}`,
              customerId: customerId,
              authorId: 'system',
              authorName: 'استيراد إكسل',
              content: row.notes,
              createdAt: now,
            });
          }

          if (row.phoneCleanDigits) {
            phoneMap.set(row.phoneCleanDigits, newCustomer);
          }
          phoneMap.set(customerId, newCustomer);
          added++;
        }
      } catch (err) {
        console.error(`Failed to import customer row ${i}:`, err);
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return { added, updated, skipped, failed };
  }

  /**
   * Log customer activity
   */
  static async logActivity(activity: CustomerActivity): Promise<void> {
    await FirestoreService.set<CustomerActivity>(COLLECTIONS.ACTIVITIES, activity.id, activity);
  }
}

