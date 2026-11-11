/**
 * CHUVATOR — Local Print Bridge Security Manager (Phase 4.3)
 *
 * Implements token authorization, CORS origin checking, request validation,
 * and security headers to prevent unauthorized access and SSRF.
 */

import crypto from 'node:crypto';
import { loadBridgePersistedConfig } from '../config/bridgeConfig.js';

export class SecurityManager {
  constructor(options = {}) {
    this.config = options.config || loadBridgePersistedConfig();
    this.pairedTokens = new Set(options.initialTokens || []);
    
    // Auto-generate a default paired token if none exists for standalone local use
    if (this.pairedTokens.size === 0) {
      if (this.config.pairingToken) {
        this.pairedTokens.add(this.config.pairingToken);
      } else {
        const defaultToken = this.generateToken('chuvator-bridge-local');
        this.pairedTokens.add(defaultToken);
      }
    }
  }

  generateToken(prefix = 'token') {
    const randomHex = crypto.randomBytes(16).toString('hex');
    return `${prefix}-${randomHex}`;
  }

  registerPairingToken(token) {
    if (!token || typeof token !== 'string') return false;
    this.pairedTokens.add(token.trim());
    return true;
  }

  isValidToken(token) {
    if (!token) return false;
    const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
    return this.pairedTokens.has(cleanToken);
  }

  isOriginAllowed(origin) {
    if (!origin) return true; // Direct non-browser requests allowed
    const allowed = this.config.allowedOrigins || [];
    return allowed.includes(origin) || allowed.includes('*');
  }

  setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin && this.isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Bridge-Token, X-Workstation-Id, X-Tenant-Id'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'false');
  }

  extractToken(req) {
    const customHeader = req.headers['x-bridge-token'];
    if (customHeader) return String(customHeader).trim();

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }

  verifyRequestAuth(req) {
    const token = this.extractToken(req);
    if (!token) {
      return {
        authorized: false,
        code: 401,
        message: 'Token otentikasi bridge tidak ditemukan. Kirimkan header X-Bridge-Token.'
      };
    }

    if (!this.isValidToken(token)) {
      return {
        authorized: false,
        code: 403,
        message: 'Token otentikasi bridge tidak valid atau tidak diizinkan.'
      };
    }

    return { authorized: true };
  }
}

export default SecurityManager;
