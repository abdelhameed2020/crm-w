import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Configuration loaded strictly from Vite environment variables (.env) with safe fallback to crm-awlad-yahya
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBlc26xWhgmxwMeFxFhQ7w0PCDw0L8zgkc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'crm-awlad-yahya.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'crm-awlad-yahya',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'crm-awlad-yahya.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '18481963471',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:18481963471:web:90e47413eeddff58d3b2ba',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-CLKFZ51QLZ',
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

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db: Firestore = firestoreDb;

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

export { analytics, firebaseConfig };
export default app;
