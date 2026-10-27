import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { AuthService } from '../../services/firebase/auth.service';
import { isFirebaseConfigured } from '../../services/firebase/config';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isFirebaseReady: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole?: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback demo user strictly for local UI testing when Firebase is NOT configured
const defaultDemoUser: UserProfile = {
  id: 'demo-admin-uid',
  email: 'admin@crm-system.local',
  displayName: 'مدير النظام (تجريبي)',
  role: 'admin',
  department: 'الإدارة العامة',
  isActive: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const STORAGE_KEY = 'omni_crm_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If user profile is already cached in localStorage, start with it immediately (0ms delay)
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (!isFirebaseConfigured && import.meta.env.DEV) {
      return defaultDemoUser;
    }
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // If user is already cached, loading is immediately false (zero spinner)
  const [loading, setLoading] = useState<boolean>(() => {
    if (!isFirebaseConfigured) return false;
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        return false;
      }
    } catch {
      // ignore
    }
    return true;
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    // Safety timeout to prevent indefinite frozen spinner
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[Auth] Auth state check reached fallback timeout, ending loading spinner.');
          return false;
        }
        return false;
      });
    }, 3000);

    // Subscribe to real server-side Firebase Authentication
    const unsubscribe = AuthService.subscribeToAuthState((userProfile, fbUser) => {
      clearTimeout(timer);
      if (userProfile) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
        } catch {}
      } else {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
      setUser(userProfile);
      setFirebaseUser(fbUser);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        if (!import.meta.env.DEV) {
          throw new Error('Authentication is unavailable: Firebase is not configured.');
        }
        setUser({
          ...defaultDemoUser,
          email,
          displayName: email.split('@')[0],
        });
        setLoading(false);
        return;
      }
      await AuthService.login(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      if (isFirebaseConfigured) {
        await AuthService.logout();
      }
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setLoading(false);
    }
  };

  // SECURITY ENFORCEMENT:
  // Role switcher is STRICTLY DISABLED in production or whenever real Firebase is active.
  // It cannot be used to spoof permissions against real Firestore documents or security rules.
  const switchDemoRole =
    !isFirebaseConfigured && import.meta.env.DEV
      ? (role: UserRole) => {
          if (user) {
            setUser({
              ...user,
              role,
              displayName:
                role === 'admin'
                  ? 'مدير النظام (معاينة)'
                  : role === 'manager'
                  ? 'مدير الفريق (معاينة)'
                  : 'موظف خدمة العملاء (معاينة)',
            });
          }
        }
      : undefined;

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isEmployee = user?.role === 'employee' || isManager;

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isFirebaseReady: isFirebaseConfigured,
        isAdmin,
        isManager,
        isEmployee,
        login,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
