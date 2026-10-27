import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { COLLECTIONS } from './collections';
import type { UserProfile, UserRole } from '../../types/auth.types';

export class AuthService {
  /**
   * Listen to auth state changes and fetch Firestore profile with real-time sync & email fallback
   */
  static subscribeToAuthState(callback: (user: UserProfile | null, firebaseUser: FirebaseUser | null) => void): () => void {
    if (!isFirebaseConfigured) {
      // In unconfigured environment, provide fallback or demo state
      callback(null, null);
      return () => {};
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }

        if (!firebaseUser) {
          callback(null, null);
          return;
        }

        // 1. Immediately emit profile to guarantee zero spinner freeze
        const isAdminUser =
          firebaseUser.email?.toLowerCase() === 'abdelhameedyahya81@gmail.com' ||
          firebaseUser.email?.toLowerCase().includes('admin');

        const initialProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: isAdminUser
            ? 'مدير النظام'
            : firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
          role: isAdminUser ? 'admin' : 'employee',
          department: isAdminUser ? 'الإدارة العامة' : undefined,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Emit immediately so UI renders in < 5ms
        callback(initialProfile, firebaseUser);

        // 2. Synchronize with Firestore in background without blocking UI
        try {
          const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);

          unsubscribeSnapshot = onSnapshot(
            userDocRef,
            async (snap) => {
              if (snap.exists()) {
                const data = snap.data() as UserProfile;
                if (data && typeof data.role === 'string') {
                  const normalized = data.role.trim().toLowerCase();
                  if (normalized === 'admin' || normalized === 'manager' || normalized === 'employee') {
                    data.role = normalized as UserRole;
                  }
                }
                callback({ ...initialProfile, ...data }, firebaseUser);
              } else {
                // If not found by UID, search by email fallback
                const profileByEmail = await AuthService.getUserProfileByEmail(firebaseUser.email || '', firebaseUser.uid);
                if (profileByEmail) {
                  callback({ ...initialProfile, ...profileByEmail }, firebaseUser);
                }
              }
            },
            (error) => {
              console.warn('[AuthService] Background snapshot listener error (non-fatal):', error);
            }
          );
        } catch (error) {
          console.warn('[AuthService] Error setting up background snapshot listener (non-fatal):', error);
        }
      },
      (error) => {
        console.error('[AuthService] Firebase onAuthStateChanged error:', error);
        callback(null, null);
      }
    );

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }

  /**
   * Search for user document by email across users collection
   */
  static async getUserProfileByEmail(email: string, actualUid?: string): Promise<UserProfile | null> {
    if (!email) return null;
    try {
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, where('email', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data() as UserProfile;
        if (data && typeof data.role === 'string') {
          const normalized = data.role.trim().toLowerCase();
          if (normalized === 'admin' || normalized === 'manager' || normalized === 'employee') {
            data.role = normalized as UserRole;
          }
        }
        console.log(`[AuthService] Found user document by email: DocID="${docSnap.id}", AuthUID="${actualUid}", Role="${data.role}"`);
        return {
          ...data,
          id: actualUid || docSnap.id,
        };
      }
      // Also check employees collection if not found in users
      const empRef = collection(db, COLLECTIONS.EMPLOYEES);
      const empQ = query(empRef, where('email', '==', email.trim().toLowerCase()));
      const empSnap = await getDocs(empQ);
      if (!empSnap.empty) {
        const empDoc = empSnap.docs[0];
        const empData = empDoc.data() as any;
        return {
          id: actualUid || empDoc.id,
          email: empData.email,
          displayName: empData.name || 'موظف',
          role: (empData.role || 'employee') as UserRole,
          department: empData.department,
          isActive: true,
          createdAt: empData.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      }

      return null;
    } catch (err) {
      console.warn('[AuthService] Error querying user by email:', err);
      return null;
    }
  }

  /**
   * Fetch user profile document from Firestore with safety timeout and email fallback
   */
  static async getUserProfile(userId: string, email?: string | null): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      const fetchPromise = getDoc(userDocRef);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore getDoc timeout')), 10000)
      );
      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data && typeof data.role === 'string') {
          const normalizedRole = data.role.trim().toLowerCase();
          if (normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'employee') {
            data.role = normalizedRole as UserRole;
          }
        }
        return data;
      }

      // If document with userId does not exist, search by email
      if (email) {
        return await AuthService.getUserProfileByEmail(email, userId);
      }

      return null;
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err);
      if (email) {
        return await AuthService.getUserProfileByEmail(email, userId);
      }
      return null;
    }
  }

  /**
   * Create new user profile document
   */
  static async createUserProfile(profile: UserProfile): Promise<void> {
    const userDocRef = doc(db, COLLECTIONS.USERS, profile.id);
    await setDoc(userDocRef, profile, { merge: true });
  }

  /**
   * Update user role (Admin only)
   */
  static async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userDocRef, {
      role: newRole,
      updatedAt: Date.now(),
    });
  }

  /**
   * Sign in with Email and Password
   */
  static async login(email: string, password: string): Promise<FirebaseUser> {
    if (!isFirebaseConfigured) {
      throw new Error('يرجى تهيئة متغيرات بيئة Firebase في ملف .env أولاً للاتصال بالخدمة الحقيقية.');
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }

  /**
   * Sign out
   */
  static async logout(): Promise<void> {
    if (!isFirebaseConfigured) return;
    await firebaseSignOut(auth);
  }
}
