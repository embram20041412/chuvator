import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import useArenaData from '../../hooks/useArenaData.js';
import { getTenantProfile } from '../../services/supabaseArenaService.js';
import { defaultPrintEngine } from './PrintEngine.js';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal.jsx';

/**
 * CHUVATOR — Central Receipt & Printing System
 * Phase 2: PrintManager
 *
 * Central orchestrator for all printing operations:
 * - printDocument(payload, options)
 * - previewDocument(payload, options)
 * - downloadPDF(payload, options)
 * - buildPrintPayload(payload, options)
 *
 * Resolves the active tenant via the application's existing `useArenaData` hook
 * and `getTenantProfile` service without creating a separate tenant or auth context.
 */

const PrintManagerContext = createContext(null);

/**
 * Resolves the active tenant profile from options, userProfile, or Supabase service
 */
export async function resolveActiveTenantProfile(options = {}, fallbackTenant = null, userProfile = null) {
  const directTenant =
    options?.tenantProfile ||
    options?.tenantData ||
    options?.arena ||
    fallbackTenant ||
    userProfile?.tenant ||
    null;

  if (directTenant && (directTenant.name || directTenant.receiptHeaderName || directTenant.receipt_header_name)) {
    return directTenant;
  }

  const tenantId =
    directTenant?.id ||
    options?.tenantId ||
    userProfile?.tenant?.id ||
    userProfile?.tenantId ||
    userProfile?.uid ||
    null;

  if (tenantId) {
    try {
      const fetched = await getTenantProfile(tenantId);
      if (fetched) return fetched;
    } catch {
      // Fallback to whatever tenant object is available in memory
    }
  }

  return directTenant || {};
}

/**
 * Programmatic factory for PrintManager (usable in services, hooks, and tests)
 */
export function createPrintManager({
  tenantProfile = null,
  userProfile = null,
  engine = defaultPrintEngine,
  onOpenPreview = null
} = {}) {
  const mergeOptionsWithTenant = (rawInput, options = {}) => {
    const resolvedTenant =
      options.tenantProfile ||
      options.tenantData ||
      rawInput?.tenantProfile ||
      rawInput?.tenantData ||
      rawInput?.arena ||
      tenantProfile ||
      userProfile?.tenant ||
      {};

    return {
      ...options,
      tenantProfile: resolvedTenant,
      userProfile: options.userProfile || userProfile || null
    };
  };

  return {
    engine,

    buildPrintPayload(rawInput, options = {}) {
      const mergedOptions = mergeOptionsWithTenant(rawInput, options);
      return engine.buildPrintPayload(rawInput, mergedOptions);
    },

    async printDocument(rawInput, options = {}) {
      const activeTenant = await resolveActiveTenantProfile(options, tenantProfile, userProfile);
      const mergedOptions = mergeOptionsWithTenant(rawInput, {
        ...options,
        tenantProfile: activeTenant
      });
      return engine.printDocument(rawInput, mergedOptions);
    },

    async downloadPDF(rawInput, options = {}) {
      const activeTenant = await resolveActiveTenantProfile(options, tenantProfile, userProfile);
      const mergedOptions = mergeOptionsWithTenant(rawInput, {
        ...options,
        tenantProfile: activeTenant
      });
      return engine.downloadPDF(rawInput, mergedOptions);
    },

    previewDocument(rawInput, options = {}) {
      const mergedOptions = mergeOptionsWithTenant(rawInput, options);
      const payload = engine.buildPrintPayload(rawInput, mergedOptions);
      if (typeof onOpenPreview === 'function') {
        onOpenPreview(payload.normalizedDoc, mergedOptions);
      }
      return payload;
    }
  };
}

/**
 * React Provider that connects PrintManager with the existing `useArenaData(userProfile)` hook
 * and manages the centralized `ReceiptPreviewModal`.
 */
export function PrintManagerProvider({
  userProfile = null,
  tenantProfile: explicitTenantProfile = null,
  engine = defaultPrintEngine,
  children
}) {
  // Reuses existing application hook for tenant resolution
  const { tenantProfile: arenaTenantProfile } = useArenaData(userProfile);
  const activeTenantProfile = explicitTenantProfile || arenaTenantProfile || userProfile?.tenant || null;

  const [previewState, setPreviewState] = useState({
    isOpen: false,
    documentData: null,
    options: {}
  });

  const handleOpenPreview = useCallback((normalizedDoc, options = {}) => {
    setPreviewState({
      isOpen: true,
      documentData: normalizedDoc,
      options
    });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewState((prev) => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const manager = useMemo(
    () =>
      createPrintManager({
        tenantProfile: activeTenantProfile,
        userProfile,
        engine,
        onOpenPreview: handleOpenPreview
      }),
    [activeTenantProfile, userProfile, engine, handleOpenPreview]
  );

  const contextValue = useMemo(
    () => ({
      ...manager,
      tenantProfile: activeTenantProfile,
      userProfile,
      previewState,
      closePreview
    }),
    [manager, activeTenantProfile, userProfile, previewState, closePreview]
  );

  return (
    <PrintManagerContext.Provider value={contextValue}>
      {children}
      <ReceiptPreviewModal
        isOpen={previewState.isOpen}
        onClose={closePreview}
        documentData={previewState.documentData}
        tenantProfile={previewState.options?.tenantProfile || activeTenantProfile}
        userProfile={previewState.options?.userProfile || userProfile}
        initialPaper={previewState.options?.paper || null}
        printEngine={engine}
      />
    </PrintManagerContext.Provider>
  );
}

/**
 * Hook to access PrintManager. Works seamlessly whether inside <PrintManagerProvider>
 * or standalone by delegating tenant resolution to the existing `useArenaData` hook.
 */
export function usePrintManager(userProfile = null) {
  const context = useContext(PrintManagerContext);
  const { tenantProfile: hookTenantProfile } = useArenaData(context ? null : userProfile);

  const standaloneManager = useMemo(() => {
    if (context) return null;
    return createPrintManager({
      tenantProfile: hookTenantProfile || userProfile?.tenant || null,
      userProfile,
      engine: defaultPrintEngine
    });
  }, [context, hookTenantProfile, userProfile]);

  return context || standaloneManager;
}

export default {
  PrintManagerProvider,
  usePrintManager,
  createPrintManager,
  resolveActiveTenantProfile
};
