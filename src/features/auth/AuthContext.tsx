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

// Fallback demo user for local development before live Firebase credentials are added
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    // If Firebase isn't configured, start with demo admin user to allow full UI inspection
    return !isFirebaseConfigured ? defaultDemoUser : null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = AuthService.subscribeToAuthState((userProfile, fbUser) => {
      setUser(userProfile);
      setFirebaseUser(fbUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        // Mock demo login
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
      if (isFirebaseConfigured) {
        await AuthService.logout();
      }
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setLoading(false);
    }
  };

  const switchDemoRole = (role: UserRole) => {
    if (user) {
      setUser({
        ...user,
        role,
        displayName: role === 'admin' ? 'مدير النظام' : role === 'manager' ? 'مدير الفريق' : 'موظف خدمة العملاء',
      });
    }
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

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
