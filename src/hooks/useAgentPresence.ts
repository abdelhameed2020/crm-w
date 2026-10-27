import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { FirestoreService } from '../services/firebase/firestore.service';
import { COLLECTIONS } from '../services/firebase/collections';
import type { Employee, EmployeePresenceStatus } from '../types/employee.types';

import { AutoAssignmentService } from '../services/assignment/AutoAssignmentService';

const HEARTBEAT_INTERVAL_MS = 45 * 1000; // 45 seconds
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes
const HIDDEN_TAB_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export function useAgentPresence() {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<EmployeePresenceStatus>('available');
  const [awayReason, setAwayReason] = useState<string | undefined>(undefined);

  const lastActivityRef = useRef<number>(Date.now());
  const hiddenTimerRef = useRef<any>(null);
  const idleTimerRef = useRef<any>(null);
  const employeeDocIdRef = useRef<string | null>(null);

  // Send heartbeat to Firestore
  const sendHeartbeat = useCallback(
    async (overrideStatus?: EmployeePresenceStatus, reason?: string) => {
      if (!user?.id && !user?.email) return;
      try {
        const now = Date.now();
        const statusToSet = overrideStatus || currentStatus;

        // 1. Resolve employee document ID by checking user.id first, then user.email
        let empId = employeeDocIdRef.current;
        if (!empId) {
          const allEmployees = await FirestoreService.list<Employee>(COLLECTIONS.EMPLOYEES);
          const target = allEmployees.find(
            (e) =>
              e.id === user?.id ||
              (user?.email && e.email?.trim().toLowerCase() === user.email.trim().toLowerCase())
          );
          if (target) {
            empId = target.id;
            employeeDocIdRef.current = target.id;
          } else if (user?.id) {
            empId = user.id;
          }
        }

        const updateData = {
          isOnline: statusToSet !== 'offline',
          status: statusToSet,
          lastHeartbeatAt: now,
          lastActiveAt: now,
          ...(reason !== undefined ? { awayReason: reason } : {}),
        };

        if (empId) {
          // Use set with merge: true to guarantee creation/update without failing
          await FirestoreService.set<any>(COLLECTIONS.EMPLOYEES, empId, updateData, true);
        }

        // Also sync profile in USERS collection
        if (user?.id) {
          await FirestoreService.set<any>(COLLECTIONS.USERS, user.id, updateData, true);
        }

        // If status became available, immediately process any waiting conversations in queue
        if (statusToSet === 'available') {
          AutoAssignmentService.processWaitingQueue().catch(() => {});
        }
      } catch (err) {
        console.warn('Failed updating presence heartbeat:', err);
      }
    },
    [user?.id, user?.email, currentStatus]
  );

  // Manual status change by agent
  const setPresenceStatus = useCallback(
    async (newStatus: EmployeePresenceStatus, reason?: string) => {
      setCurrentStatus(newStatus);
      setAwayReason(reason);
      await sendHeartbeat(newStatus, reason);
    },
    [sendHeartbeat]
  );

  useEffect(() => {
    if (!user?.id) return;

    // 1. Initial connect: Mark as available and send first heartbeat
    sendHeartbeat('available');

    // 2. Periodic Heartbeat Timer
    const heartbeatInterval = setInterval(() => {
      // Only ping if window is visible and user was active recently
      if (document.visibilityState === 'visible' && currentStatus !== 'offline') {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // 3. Activity Tracker (Mouse, Keyboard, Touch)
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();

      // If agent was marked away due to inactivity, auto-restore to available
      if (currentStatus === 'away' && awayReason === 'خمول لعدم التفاعل') {
        setCurrentStatus('available');
        setAwayReason(undefined);
        sendHeartbeat('available', '');
      }

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // User has been idle for 5 minutes
        if (currentStatus === 'available') {
          setCurrentStatus('away');
          setAwayReason('خمول لعدم التفاعل');
          sendHeartbeat('away', 'خمول لعدم التفاعل');
        }
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    // 4. Tab Visibility Detection (Page Visibility API)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Start timer to mark as away after 3 minutes in background
        hiddenTimerRef.current = setTimeout(() => {
          if (currentStatus === 'available') {
            setCurrentStatus('away');
            setAwayReason('التبويب مصغر أو في الخلفية');
            sendHeartbeat('away', 'التبويب مصغر أو في الخلفية');
          }
        }, HIDDEN_TAB_TIMEOUT_MS);
      } else {
        // Returned to tab
        if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
        if (currentStatus === 'away' && awayReason?.includes('التبويب')) {
          setCurrentStatus('available');
          setAwayReason(undefined);
          sendHeartbeat('available', '');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Window BeforeUnload / Close Tab
    const handleBeforeUnload = () => {
      const empId = employeeDocIdRef.current || user?.id;
      if (empId) {
        FirestoreService.set<any>(
          COLLECTIONS.EMPLOYEES,
          empId,
          {
            isOnline: false,
            status: 'offline',
            lastActiveAt: Date.now(),
          },
          true
        ).catch(() => {});
      }
      if (user?.id) {
        FirestoreService.set<any>(
          COLLECTIONS.USERS,
          user.id,
          {
            isOnline: false,
            status: 'offline',
            lastActiveAt: Date.now(),
          },
          true
        ).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id, sendHeartbeat, currentStatus, awayReason]);

  return {
    status: currentStatus,
    currentStatus,
    awayReason,
    setPresenceStatus,
  };
}
