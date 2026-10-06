import { orderBy, type Unsubscribe } from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { WhatsAppAccount } from '../../types/whatsapp.types';

export class WhatsAppAccountsService {
  /**
   * Subscribe in real-time to all WhatsApp accounts in Firestore
   */
  static subscribeToAccounts(
    callback: (accounts: WhatsAppAccount[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<WhatsAppAccount>(
      COLLECTIONS.WHATSAPP_ACCOUNTS,
      [orderBy('createdAt', 'desc')],
      callback,
      onError
    );
  }

  /**
   * Get single WhatsApp account
   */
  static async getAccount(accountId: string): Promise<WhatsAppAccount | null> {
    return FirestoreService.getById<WhatsAppAccount>(COLLECTIONS.WHATSAPP_ACCOUNTS, accountId);
  }

  /**
   * Create new WhatsApp account document
   */
  static async createAccount(account: WhatsAppAccount): Promise<void> {
    await FirestoreService.set<WhatsAppAccount>(COLLECTIONS.WHATSAPP_ACCOUNTS, account.id, account);
  }

  /**
   * Update account status or settings
   */
  static async updateAccount(accountId: string, data: Partial<WhatsAppAccount>): Promise<void> {
    await FirestoreService.update<WhatsAppAccount>(COLLECTIONS.WHATSAPP_ACCOUNTS, accountId, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  /**
   * Delete account record
   */
  static async deleteAccount(accountId: string): Promise<void> {
    await FirestoreService.delete(COLLECTIONS.WHATSAPP_ACCOUNTS, accountId);
  }
}
