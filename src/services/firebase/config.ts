import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Configuration loaded strictly from Vite environment variables (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your-project-id'
);

// Initialize Firebase app as a singleton
let app: FirebaseApp;
if (!getApps().length) {
  // If not configured, initialize with safe dummy object only to prevent crashes before env is supplied
  app = initializeApp(
    isFirebaseConfigured
      ? firebaseConfig
      : {
          apiKey: 'unconfigured-api-key',
          projectId: 'unconfigured-project',
          authDomain: 'unconfigured.firebaseapp.com',
          appId: '1:0000000000:web:00000000',
        }
  );
} else {
  app = getApps()[0];
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Initialize Analytics conditionally if supported in browser environment
let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && isFirebaseConfigured && firebaseConfig.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((err) => {
      console.warn('Firebase Analytics not supported in this environment:', err);
    });
}

export { analytics };
export default app;
