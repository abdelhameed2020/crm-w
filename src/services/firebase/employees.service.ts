import { orderBy, type Unsubscribe } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import { auth, firebaseConfig, isFirebaseConfigured } from './config';
import type { Employee } from '../../types/employee.types';
import type { UserProfile } from '../../types/auth.types';

export class EmployeesService {
  static subscribeToEmployees(
    callback: (employees: Employee[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<Employee>(
      COLLECTIONS.EMPLOYEES,
      [orderBy('name', 'asc')],
      callback,
      onError
    );
  }

  static async getEmployee(id: string): Promise<Employee | null> {
    return FirestoreService.getById<Employee>(COLLECTIONS.EMPLOYEES, id);
  }

  static async saveEmployee(employee: Employee): Promise<void> {
    await FirestoreService.set<Employee>(COLLECTIONS.EMPLOYEES, employee.id, employee);
  }

  /**
   * Create an employee account in Firebase Authentication (with password)
   * AND in Firestore collections (both employees and users for RBAC).
   * Handles auth/email-already-in-use if previousPassword is provided or
   * if the account exists with the same credentials.
   */
  static async createEmployeeWithAuth(
    employeeData: Omit<Employee, 'id' | 'createdAt'>,
    password?: string,
    previousPassword?: string
  ): Promise<Employee> {
    let authUid = `emp_${Date.now()}`;

    // If password provided and Firebase is configured, create Auth account via temporary secondary app
    if (password && isFirebaseConfigured) {
      const tempAppName = `temp-auth-creator-${Date.now()}`;
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      try {
        const cred = await createUserWithEmailAndPassword(tempAuth, employeeData.email, password);
        authUid = cred.user.uid;
        await signOut(tempAuth);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // The email already exists in Firebase Auth
          let signedInUid: string | null = null;
          const passwordsToTry = [password, previousPassword].filter(Boolean) as string[];

          for (const pwd of passwordsToTry) {
            try {
              const signCred = await signInWithEmailAndPassword(tempAuth, employeeData.email, pwd);
              signedInUid = signCred.user.uid;
              // If authenticated with previousPassword and a new password was provided, update it now!
              if (pwd !== password && password) {
                await updatePassword(signCred.user, password);
              }
              await signOut(tempAuth);
              break;
            } catch {
              // try next password option
            }
          }

          if (signedInUid) {
            authUid = signedInUid;
          } else {
            const customErr = new Error(
              `البريد (${employeeData.email}) مسجل مسبقاً في Firebase Authentication.`
            );
            (customErr as any).code = 'auth/email-already-in-use';
            throw customErr;
          }
        } else {
          throw authErr;
        }
      } finally {
        await deleteApp(tempApp).catch(() => {});
      }
    }

    const newEmployee: Employee = {
      ...employeeData,
      id: authUid,
      createdAt: Date.now(),
    };

    // 1. Save in employees collection
    await FirestoreService.set<Employee>(COLLECTIONS.EMPLOYEES, authUid, newEmployee);

    // 2. Save in users collection for RBAC
    const userProfile: UserProfile = {
      id: authUid,
      email: newEmployee.email,
      displayName: newEmployee.name,
      role: newEmployee.role,
      department: newEmployee.department,
      phoneNumber: newEmployee.phone,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await FirestoreService.set<UserProfile>(COLLECTIONS.USERS, authUid, userProfile);

    return newEmployee;
  }

  /**
   * Update employee details in Firestore (both employees and users collections)
   * And optionally update Firebase Auth password if currentPassword is provided,
   * or trigger a password reset email.
   */
  static async updateEmployee(
    id: string,
    updates: Partial<Employee>,
    newPassword?: string,
    currentPassword?: string
  ): Promise<void> {
    // 1. Update in employees collection
    await FirestoreService.update<Employee>(COLLECTIONS.EMPLOYEES, id, {
      ...updates,
      updatedAt: Date.now(),
    } as any);

    // 2. Update corresponding user document for RBAC
    await FirestoreService.update<UserProfile>(COLLECTIONS.USERS, id, {
      ...(updates.name ? { displayName: updates.name } : {}),
      ...(updates.role ? { role: updates.role } : {}),
      ...(updates.department ? { department: updates.department } : {}),
      ...(updates.phone !== undefined ? { phoneNumber: updates.phone } : {}),
      updatedAt: Date.now(),
    }).catch(() => {});

    // 3. If password change requested
    if (newPassword && isFirebaseConfigured) {
      if (currentPassword && updates.email) {
        const tempAppName = `temp-pwd-changer-${Date.now()}`;
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);
        try {
          const cred = await signInWithEmailAndPassword(tempAuth, updates.email, currentPassword);
          await updatePassword(cred.user, newPassword);
          await signOut(tempAuth);
        } finally {
          await deleteApp(tempApp).catch(() => {});
        }
      } else if (updates.email) {
        // Send reset email so employee can set new password
        await sendPasswordResetEmail(auth, updates.email);
      }
    }
  }

  /**
   * Send password reset email to employee
   */
  static async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured) return;
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Delete an employee document from Firestore (both employees and users collections)
   * and optionally from Firebase Auth if credentials provided.
   */
  static async deleteEmployee(id: string, email?: string, password?: string): Promise<void> {
    if (email && password && isFirebaseConfigured) {
      const tempAppName = `temp-del-user-${Date.now()}`;
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      try {
        const cred = await signInWithEmailAndPassword(tempAuth, email, password);
        await cred.user.delete();
      } catch (e) {
        console.warn('Could not delete user from Firebase Auth:', e);
      } finally {
        await deleteApp(tempApp).catch(() => {});
      }
    }

    await FirestoreService.delete(COLLECTIONS.EMPLOYEES, id);
    await FirestoreService.delete(COLLECTIONS.USERS, id).catch(() => {});
  }
}
