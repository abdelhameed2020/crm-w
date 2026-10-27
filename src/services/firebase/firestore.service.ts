import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  type QueryConstraint,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { CollectionName } from './collections';

/**
 * Base Firestore Service with Type Safety.
 * Prevents raw Firestore calls in UI components and provides centralized error handling.
 */
/**
 * Recursively removes undefined fields from an object to comply with Firestore specifications.
 */
function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = removeUndefinedFields(value);
    }
  }
  return clean as T;
}

export class FirestoreService {
  /**
   * Fetch a single document by ID
   */
  static async getById<T>(colName: CollectionName, id: string): Promise<T | null> {
    if (!isFirebaseConfigured) return null;
    const docRef = doc(db, colName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  }

  /**
   * Fetch list of documents with optional constraints
   */
  static async list<T>(colName: CollectionName, ...constraints: QueryConstraint[]): Promise<T[]> {
    if (!isFirebaseConfigured) return [];
    const colRef = collection(db, colName);
    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
  }

  /**
   * Realtime subscription to a query
   */
  static subscribe<T>(
    colName: CollectionName,
    constraints: QueryConstraint[],
    callback: (data: T[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured) {
      callback([]);
      return () => {};
    }
    const colRef = collection(db, colName);
    const q = query(colRef, ...constraints);
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
        callback(items);
      },
      (error) => {
        console.error(`Firestore error on ${colName} subscription:`, error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Set or merge a document
   */
  static async set<T extends DocumentData>(colName: CollectionName, id: string, data: T, merge = true): Promise<void> {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, colName, id);
    const cleanData = removeUndefinedFields(data);
    await setDoc(docRef, cleanData, { merge });
  }

  /**
   * Update existing document
   */
  static async update<T extends DocumentData>(colName: CollectionName, id: string, data: Partial<T>): Promise<void> {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, colName, id);
    const cleanData = removeUndefinedFields(data);
    await updateDoc(docRef, cleanData as DocumentData);
  }

  /**
   * Delete a document
   */
  static async delete(colName: CollectionName, id: string): Promise<void> {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
  }
}
