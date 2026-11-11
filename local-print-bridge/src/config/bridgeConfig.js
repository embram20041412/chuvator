/**
 * CHUVATOR — Local Print Bridge Configuration (Phase 4.3)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_FILE_PATH = path.join(os.homedir(), '.chuvator-bridge-config.json');

export const DEFAULT_BRIDGE_CONFIG = Object.freeze({
  port: parseInt(process.env.BRIDGE_PORT || '9123', 10),
  host: '127.0.0.1',
  version: '1.0.0',
  allowedOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://app.chuvator.com'
  ],
  maxPayloadSizeBytes: 2 * 1024 * 1024, // 2MB
  jobTimeoutMs: 15000,
  defaultPrinterType: 'bluetooth_spp'
});

export function loadBridgePersistedConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_BRIDGE_CONFIG,
        ...parsed
      };
    }
  } catch {
    // Return default on error
  }
  return { ...DEFAULT_BRIDGE_CONFIG };
}

export function saveBridgePersistedConfig(configPatch) {
  try {
    const current = loadBridgePersistedConfig();
    const updated = {
      ...current,
      ...configPatch,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    return null;
  }
}

export default {
  DEFAULT_BRIDGE_CONFIG,
  loadBridgePersistedConfig,
  saveBridgePersistedConfig
};
