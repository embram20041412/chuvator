/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 3: PrinterConfiguration
 *
 * Manages local workstation physical printer configuration in localStorage
 * with strict separation from:
 * 1. Tenant receipt identity (always resolved dynamically from the active tenant).
 * 2. User-per-tenant operational preferences (isolated by tenantId + userId).
 *
 * Includes resilient fallbacks when localStorage is unavailable, disabled, or corrupted,
 * and strips any tenant identity or sensitive credential fields from workstation storage.
 */

import { PRINT_ADAPTERS } from '../types/printTypes.js';

export const WORKSTATION_PRINTER_CONFIG_KEY = 'chuvator_workstation_printer_config_v1';
export const USER_PRINT_PREFS_PREFIX = 'chuvator_user_print_prefs_v1';

export const CONNECTION_STATUS = Object.freeze({
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR'
});

export const VALID_ADAPTERS = Object.freeze([
  PRINT_ADAPTERS.BROWSER,
  PRINT_ADAPTERS.WEB_USB,
  PRINT_ADAPTERS.WEB_BLUETOOTH,
  PRINT_ADAPTERS.LOCAL_BRIDGE
]);

export const VALID_RECEIPT_PAPERS = Object.freeze(['58mm', '80mm']);
export const VALID_DOCUMENT_PAPERS = Object.freeze(['A4', 'A5']);
export const VALID_ORIENTATIONS = Object.freeze(['portrait', 'landscape']);

export const DEFAULT_WORKSTATION_PRINTER_CONFIG = Object.freeze({
  preferredAdapter: PRINT_ADAPTERS.BROWSER,
  receiptPaperSize: '80mm',
  documentPaperSize: 'A4',
  preferredDocumentOrientation: 'portrait',
  autoPrintAfterCheckout: false,
  pairedDeviceMetadata: null,
  printerDisplayName: 'Browser / System Print',
  lastConnectionStatus: CONNECTION_STATUS.DISCONNECTED,
  updatedAt: null
});

export const DEFAULT_USER_PRINT_PREFS = Object.freeze({
  autoOpenPreviewAfterCheckout: true,
  defaultReceiptFormat: 'THERMAL_RECEIPT',
  updatedAt: null
});

// In-memory fallback store used when localStorage is unavailable or blocked
const memoryFallbackStore = new Map();

/**
 * Checks whether a user role is a platform superuser without tenant hardware context
 * @param {any} [userProfile]
 */
export function isSuperuserPlatformRole(userProfile = undefined) {
  if (!userProfile) return false;
  const role = String(userProfile.role || '').toLowerCase().trim();
  const hasTenantScope = Boolean(
    userProfile.tenant?.id || userProfile.tenantId || userProfile.tenant_id
  );
  return (role === 'superadmin' || role === 'superuser' || role === 'platform_owner') && !hasTenantScope;
}

/**
 * Resolves a safe storage adapter (custom storage, window.localStorage, or memory fallback)
 * @param {any} [customStorage]
 */
function resolveStorage(customStorage = undefined) {
  if (customStorage && typeof customStorage.getItem === 'function' && typeof customStorage.setItem === 'function') {
    return { storage: customStorage, isPersistent: true };
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probeKey = '__chuvator_storage_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return { storage: window.localStorage, isPersistent: true };
    }
  } catch {
    // localStorage blocked (e.g., private mode, iframe sandbox, or disabled storage)
  }

  return {
    storage: {
      getItem: (k) => (memoryFallbackStore.has(k) ? memoryFallbackStore.get(k) : null),
      setItem: (k, v) => memoryFallbackStore.set(k, String(v)),
      removeItem: (k) => memoryFallbackStore.delete(k)
    },
    isPersistent: false
  };
}

/**
 * Sanitizes paired device metadata so only non-sensitive hardware identifiers are stored.
 * Explicitly excludes any tenant fields or secret tokens.
 */
export function sanitizePairedDeviceMetadata(rawMeta) {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
    return null;
  }

  const transport = ['webusb', 'webbluetooth', 'bridge', 'browser'].includes(
    String(rawMeta.transport || '').toLowerCase()
  )
    ? String(rawMeta.transport).toLowerCase()
    : 'unknown';

  const id = String(rawMeta.id || rawMeta.deviceId || '').trim();
  const name = String(rawMeta.name || rawMeta.productName || rawMeta.deviceName || '').trim();
  const manufacturerName = String(rawMeta.manufacturerName || '').trim();
  const vendorId = Number.isInteger(Number(rawMeta.vendorId)) && rawMeta.vendorId !== null && rawMeta.vendorId !== undefined
    ? Number(rawMeta.vendorId)
    : null;
  const productId = Number.isInteger(Number(rawMeta.productId)) && rawMeta.productId !== null && rawMeta.productId !== undefined
    ? Number(rawMeta.productId)
    : null;

  if (!id && !name && vendorId === null && productId === null) {
    return null;
  }

  return {
    id: id || `${transport}-${vendorId ?? 'x'}-${productId ?? 'x'}`,
    name: name || 'Perangkat Printer Terdaftar',
    manufacturerName: manufacturerName || '',
    transport,
    vendorId,
    productId,
    pairedAt: rawMeta.pairedAt || new Date().toISOString()
  };
}

/**
 * Validates and normalizes workstation printer configuration.
 * Strictly strips any tenant identity fields (tenantId, receiptHeaderName, bankAccounts, etc.)
 * and any sensitive credentials/tokens.
 */
export function sanitizeWorkstationPrinterConfig(input = {}) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  const rawAdapter = String(src.preferredAdapter || '').toLowerCase().trim();
  const preferredAdapter = VALID_ADAPTERS.includes(rawAdapter)
    ? rawAdapter
    : DEFAULT_WORKSTATION_PRINTER_CONFIG.preferredAdapter;

  const rawReceiptSize = String(src.receiptPaperSize || '').trim();
  const receiptPaperSize = VALID_RECEIPT_PAPERS.includes(rawReceiptSize)
    ? rawReceiptSize
    : rawReceiptSize.toLowerCase() === '58mm'
    ? '58mm'
    : rawReceiptSize.toLowerCase() === '80mm'
    ? '80mm'
    : DEFAULT_WORKSTATION_PRINTER_CONFIG.receiptPaperSize;

  const rawDocSize = String(src.documentPaperSize || '').toUpperCase().trim();
  const documentPaperSize = VALID_DOCUMENT_PAPERS.includes(rawDocSize)
    ? rawDocSize
    : DEFAULT_WORKSTATION_PRINTER_CONFIG.documentPaperSize;

  const rawOrientation = String(src.preferredDocumentOrientation || '').toLowerCase().trim();
  const preferredDocumentOrientation = VALID_ORIENTATIONS.includes(rawOrientation)
    ? rawOrientation
    : DEFAULT_WORKSTATION_PRINTER_CONFIG.preferredDocumentOrientation;

  const autoPrintAfterCheckout = Boolean(
    src.autoPrintAfterCheckout ?? DEFAULT_WORKSTATION_PRINTER_CONFIG.autoPrintAfterCheckout
  );

  const pairedDeviceMetadata = sanitizePairedDeviceMetadata(src.pairedDeviceMetadata);

  const printerDisplayName = String(
    src.printerDisplayName ||
    pairedDeviceMetadata?.name ||
    DEFAULT_WORKSTATION_PRINTER_CONFIG.printerDisplayName
  ).trim();

  const rawStatus = String(src.lastConnectionStatus || '').toUpperCase().trim();
  const lastConnectionStatus = Object.values(CONNECTION_STATUS).includes(rawStatus)
    ? rawStatus
    : DEFAULT_WORKSTATION_PRINTER_CONFIG.lastConnectionStatus;

  return {
    preferredAdapter,
    receiptPaperSize,
    documentPaperSize,
    preferredDocumentOrientation,
    autoPrintAfterCheckout,
    pairedDeviceMetadata,
    printerDisplayName,
    lastConnectionStatus,
    updatedAt: src.updatedAt || new Date().toISOString()
  };
}

/**
 * Loads workstation printer configuration safely from localStorage (or fallback memory).
 * Never throws on corrupted JSON or unavailable storage.
 */
export function loadWorkstationPrinterConfig(options = {}) {
  const { storage, isPersistent } = resolveStorage(options.storage);

  try {
    const rawJson = storage.getItem(WORKSTATION_PRINTER_CONFIG_KEY);
    if (!rawJson) {
      return {
        config: { ...DEFAULT_WORKSTATION_PRINTER_CONFIG },
        isDefault: true,
        isPersistent,
        wasCorrupted: false
      };
    }

    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Corrupted printer configuration structure');
    }

    const sanitized = sanitizeWorkstationPrinterConfig(parsed);
    return {
      config: sanitized,
      isDefault: false,
      isPersistent,
      wasCorrupted: false
    };
  } catch {
    // Self-heal corrupted entry and return safe defaults
    try {
      storage.removeItem(WORKSTATION_PRINTER_CONFIG_KEY);
    } catch {
      // Ignore remove failure
    }
    return {
      config: { ...DEFAULT_WORKSTATION_PRINTER_CONFIG },
      isDefault: true,
      isPersistent,
      wasCorrupted: true
    };
  }
}

/**
 * Saves workstation printer configuration to localStorage (or fallback memory).
 * Blocks platform superusers without tenant context from mutating tenant workstation configs,
 * and strips any tenant identity or secret fields.
 */
export function saveWorkstationPrinterConfig(partialOrFullConfig = {}, options = {}) {
  if (options.userProfile && isSuperuserPlatformRole(options.userProfile)) {
    return {
      ok: false,
      reason: 'SUPERUSER_NO_PHYSICAL_PRINTER_SCOPE',
      message: 'Superuser platform tidak memiliki konfigurasi printer fisik tenant.',
      config: { ...DEFAULT_WORKSTATION_PRINTER_CONFIG }
    };
  }

  const { storage, isPersistent } = resolveStorage(options.storage);
  const current = loadWorkstationPrinterConfig({ storage }).config;

  const merged = sanitizeWorkstationPrinterConfig({
    ...current,
    ...(partialOrFullConfig || {}),
    updatedAt: new Date().toISOString()
  });

  try {
    storage.setItem(WORKSTATION_PRINTER_CONFIG_KEY, JSON.stringify(merged));
    return {
      ok: true,
      isPersistent,
      config: merged
    };
  } catch (err) {
    // Fallback to memory store if localStorage write fails (e.g. QuotaExceededError)
    memoryFallbackStore.set(WORKSTATION_PRINTER_CONFIG_KEY, JSON.stringify(merged));
    return {
      ok: true,
      isPersistent: false,
      warning: err?.message || 'Storage write fallback to memory',
      config: merged
    };
  }
}

/**
 * Resets workstation printer configuration back to factory defaults
 */
export function resetWorkstationPrinterConfig(options = {}) {
  const { storage, isPersistent } = resolveStorage(options.storage);
  try {
    storage.removeItem(WORKSTATION_PRINTER_CONFIG_KEY);
  } catch {
    // Ignore
  }
  memoryFallbackStore.delete(WORKSTATION_PRINTER_CONFIG_KEY);

  return {
    ok: true,
    isPersistent,
    config: { ...DEFAULT_WORKSTATION_PRINTER_CONFIG }
  };
}

/**
 * Builds isolated storage key for user operational preferences per tenant
 */
export function getUserPrintPrefsKey(tenantId, userId) {
  const safeTenant = String(tenantId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const safeUser = String(userId || 'anonymous').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeTenant) return null;
  return `${USER_PRINT_PREFS_PREFIX}_${safeTenant}_${safeUser}`;
}

/**
 * Loads user operational printing preferences isolated per (tenantId, userId)
 */
export function loadUserPrintPreferences(tenantId, userId, options = {}) {
  const key = getUserPrintPrefsKey(tenantId, userId);
  if (!key) {
    return { ...DEFAULT_USER_PRINT_PREFS };
  }

  const { storage } = resolveStorage(options.storage);
  try {
    const raw = storage.getItem(key);
    if (!raw) return { ...DEFAULT_USER_PRINT_PREFS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_USER_PRINT_PREFS };
    }
    return {
      autoOpenPreviewAfterCheckout: Boolean(
        parsed.autoOpenPreviewAfterCheckout ?? DEFAULT_USER_PRINT_PREFS.autoOpenPreviewAfterCheckout
      ),
      defaultReceiptFormat:
        parsed.defaultReceiptFormat === 'OFFICIAL_RECEIPT_A5'
          ? 'OFFICIAL_RECEIPT_A5'
          : 'THERMAL_RECEIPT',
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return { ...DEFAULT_USER_PRINT_PREFS };
  }
}

/**
 * Saves user operational printing preferences isolated per (tenantId, userId)
 */
export function saveUserPrintPreferences(tenantId, userId, prefs = {}, options = {}) {
  if (options.userProfile && isSuperuserPlatformRole(options.userProfile)) {
    return {
      ok: false,
      reason: 'SUPERUSER_NO_TENANT_PREFS',
      prefs: { ...DEFAULT_USER_PRINT_PREFS }
    };
  }

  const key = getUserPrintPrefsKey(tenantId, userId);
  if (!key) {
    return {
      ok: false,
      reason: 'MISSING_TENANT_ID',
      prefs: { ...DEFAULT_USER_PRINT_PREFS }
    };
  }

  const { storage, isPersistent } = resolveStorage(options.storage);
  const current = loadUserPrintPreferences(tenantId, userId, { storage });
  const nextPrefs = {
    autoOpenPreviewAfterCheckout: Boolean(
      prefs.autoOpenPreviewAfterCheckout ?? current.autoOpenPreviewAfterCheckout
    ),
    defaultReceiptFormat:
      prefs.defaultReceiptFormat === 'OFFICIAL_RECEIPT_A5'
        ? 'OFFICIAL_RECEIPT_A5'
        : current.defaultReceiptFormat,
    updatedAt: new Date().toISOString()
  };

  try {
    storage.setItem(key, JSON.stringify(nextPrefs));
    return { ok: true, isPersistent, prefs: nextPrefs };
  } catch {
    memoryFallbackStore.set(key, JSON.stringify(nextPrefs));
    return { ok: true, isPersistent: false, prefs: nextPrefs };
  }
}

export default {
  WORKSTATION_PRINTER_CONFIG_KEY,
  USER_PRINT_PREFS_PREFIX,
  CONNECTION_STATUS,
  DEFAULT_WORKSTATION_PRINTER_CONFIG,
  DEFAULT_USER_PRINT_PREFS,
  isSuperuserPlatformRole,
  sanitizePairedDeviceMetadata,
  sanitizeWorkstationPrinterConfig,
  loadWorkstationPrinterConfig,
  saveWorkstationPrinterConfig,
  resetWorkstationPrinterConfig,
  loadUserPrintPreferences,
  saveUserPrintPreferences
};
