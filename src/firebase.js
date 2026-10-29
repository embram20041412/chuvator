import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export { firebaseConfig };

// Custom error handler helper for Firestore operations
export const handleFirestoreError = (error, operationType, path) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
    }
  };
  console.error(`[Firestore Error - ${operationType} on ${path}]:`, JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
};

export default app;
