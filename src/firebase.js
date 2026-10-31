/**
 * Neutralized Firebase stub - Chua Sport Core has migrated to Supabase.
 * This file is retained with dummy exports to prevent build breakages
 * and does not initialize any Firebase connection or network requests.
 */

export const auth = null;
export const db = null;
export const storage = null;
export const googleProvider = null;
export const firebaseConfig = {};

export const handleFirestoreError = (error, operationType, path) => {
  console.warn(`[Legacy Firestore call intercepted - migrated to Supabase] ${operationType} on ${path}:`, error);
  return error instanceof Error ? error : new Error(String(error));
};

export default null;
