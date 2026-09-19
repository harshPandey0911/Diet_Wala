import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || ""
};

// Internal state
let app;
let firebaseAuth = null;
let googleProvider = null;
let firebaseRealtimeDb = null;

/**
 * Ensures Firebase app is initialized but stays silent.
 */
// Google API keys always match this shape; catches blank/placeholder/typo'd
// keys (e.g. a bad Vercel env var) before they reach the Firebase SDK, where
// the resulting auth/invalid-api-key error is thrown deep in async internals
// that React's error boundary and our try/catch blocks cannot reach.
function isPlausibleApiKey(key) {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(String(key || ''));
}

function initializeBaseApp() {
  if (app) return app;
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else if (isPlausibleApiKey(firebaseConfig.apiKey)) {
      app = initializeApp(firebaseConfig);
    } else if (firebaseConfig.apiKey) {
      console.warn("Firebase initializeBaseApp skipped: VITE_FIREBASE_API_KEY looks invalid.");
    }
  } catch (err) {
    console.warn("Firebase initializeBaseApp failed:", err?.message || err);
  }
  return app;
}

/**
 * Get the initialized Firebase Auth instance lazily.
 */
export function getFirebaseAuth() {
  if (!firebaseAuth) {
    try {
      if (!isPlausibleApiKey(firebaseConfig.apiKey)) {
        console.warn("Firebase Auth skipped: VITE_FIREBASE_API_KEY is missing or invalid.");
        return null;
      }
      const firebaseApp = initializeBaseApp();
      if (!firebaseApp) return null;
      firebaseAuth = getAuth(firebaseApp);
    } catch (err) {
      console.warn("Firebase Auth initialization failed:", err?.message || err);
      return null;
    }
  }
  return firebaseAuth;
}

/**
 * Get the initialized Google Auth Provider lazily.
 */
export function getGoogleAuthProvider() {
  if (!googleProvider) {
    try {
      googleProvider = new GoogleAuthProvider();
    } catch (err) {
      console.warn("GoogleAuthProvider initialization failed:", err?.message || err);
      return null;
    }
  }
  return googleProvider;
}

/**
 * Legacy support: ensuring Firebase is initialized.
 * Now it only initializes the basic App and Realtime DB if requested.
 * Auth initialization is skipped by default to avoid stale 'getProjectConfig' calls.
 */
export function ensureFirebaseInitialized(options = {}) {
  const { enableAuth = false, enableRealtimeDb = true } = options;
  try {
    const firebaseApp = initializeBaseApp();
    if (!firebaseApp) return null;

    if (enableAuth) {
      getFirebaseAuth();
    }

    if (enableRealtimeDb && !firebaseRealtimeDb) {
      try {
        if (firebaseConfig.databaseURL) {
          firebaseRealtimeDb = getDatabase(firebaseApp);
        }
      } catch (dbErr) {
        console.warn("Firebase Realtime DB init failed:", dbErr?.message || dbErr);
      }
    }
    
    return firebaseApp;
  } catch (err) {
    console.warn("ensureFirebaseInitialized failed:", err?.message || err);
    return null;
  }
}

// Proxies for export
export { app as firebaseApp, firebaseAuth, googleProvider, firebaseRealtimeDb };
