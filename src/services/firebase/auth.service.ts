import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import { COLLECTIONS } from './collections';
import type { UserProfile, UserRole } from '../../types/auth.types';

export class AuthService {
  /**
   * Listen to auth state changes and fetch Firestore profile
   */
  static subscribeToAuthState(callback: (user: UserProfile | null, firebaseUser: FirebaseUser | null) => void): () => void {
    if (!isFirebaseConfigured) {
      // In unconfigured environment, provide fallback or demo state
      callback(null, null);
      return () => {};
    }

    return onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          callback(null, null);
          return;
        }

        try {
          const profile = await AuthService.getUserProfile(firebaseUser.uid);
          if (profile) {
            callback(profile, firebaseUser);
          } else {
            // If profile doc doesn't exist yet, create a default base profile
            const defaultProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
              role: 'employee', // Default safe least-privilege role
              isActive: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await AuthService.createUserProfile(defaultProfile).catch((err) => {
              console.warn('Could not auto-create user profile in Firestore:', err);
            });
            callback(defaultProfile, firebaseUser);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          callback(null, firebaseUser);
        }
      },
      (error) => {
        console.error('Firebase onAuthStateChanged error:', error);
        callback(null, null);
      }
    );
  }

  /**
   * Fetch user profile document from Firestore with safety timeout
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      const fetchPromise = getDoc(userDocRef);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore getDoc timeout')), 4000)
      );
      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as UserProfile;
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err);
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
