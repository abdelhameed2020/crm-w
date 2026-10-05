import {
  orderBy,
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
    onError?: (error: Error) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<Customer>(
      COLLECTIONS.CUSTOMERS,
      [orderBy('updatedAt', 'desc'), limit(50)],
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
   * Log customer activity
   */
  static async logActivity(activity: CustomerActivity): Promise<void> {
    await FirestoreService.set<CustomerActivity>(COLLECTIONS.ACTIVITIES, activity.id, activity);
  }
}
