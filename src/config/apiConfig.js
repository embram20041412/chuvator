/**
 * =========================================================================================
 * KONFIGURASI API BACKEND FULL-STACK EXPRESS (SINGLE SOURCE OF TRUTH)
 * =========================================================================================
 * Rujukan tunggal untuk seluruh komunikasi HTTP ke Backend (Staff & Auth RBAC).
 * Berjalan langsung di server Node.js Express internal (Google AI Studio & Cloud Run).
 */

export const LOCAL_STORAGE_WORKER_KEY = 'CHUA_WORKER_URL_OVERRIDE';

export function resolveWorkerBaseUrl() {
  // 1. Cek runtime override di browser jika tersedia
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_WORKER_KEY);
      if (stored && typeof stored === 'string' && stored.trim()) {
        return cleanUrl(stored.trim());
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }

  // 2. Cek environment variable VITE_WORKER_URL
  const envUrl = import.meta.env.VITE_WORKER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const cleaned = cleanUrl(envUrl.trim());
    if (!import.meta.env.DEV && cleaned.includes('localhost')) {
      return typeof window !== 'undefined' ? window.location.origin : '';
    }
    return cleaned;
  }

  // 3. Native Full-Stack Express Server (Google AI Studio / Cloud Run)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

function cleanUrl(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

export function buildWorkerEndpoints(baseUrl = resolveWorkerBaseUrl()) {
  const base = cleanUrl(baseUrl);
  return {
    BASE: base || (typeof window !== 'undefined' ? window.location.origin : ''),
    CREATE_STAFF: `${base}/api/create-staff`,
    LOGIN_STAFF: `${base}/api/login-staff`,
    HEALTH: `${base}/api/health`,
    SET_CLAIMS: `${base}/api/set-custom-claims`,
  };
}

export const WORKER_BASE_URL = resolveWorkerBaseUrl();

export const WORKER_ENDPOINTS = buildWorkerEndpoints(WORKER_BASE_URL);

export function setWorkerUrlOverride(url) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!url || !url.trim()) {
      window.localStorage.removeItem(LOCAL_STORAGE_WORKER_KEY);
    } else {
      window.localStorage.setItem(LOCAL_STORAGE_WORKER_KEY, cleanUrl(url.trim()));
    }
  }
}

export function resetWorkerUrlOverride() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LOCAL_STORAGE_WORKER_KEY);
  }
}

export function getWorkerUrlOverride() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(LOCAL_STORAGE_WORKER_KEY) || null;
  }
  return null;
}
