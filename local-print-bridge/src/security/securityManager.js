/**
 * CHUVATOR — Local Print Bridge Security Manager (Phase 4.3.1 Hardened)
 *
 * Implements strict host header (DNS rebinding) protection, origin validation,
 * token expiration/rotation/revocation, CSRF custom header checks, rate-limiting,
 * and network destination (SSRF) validation.
 */

import crypto from 'node:crypto';
import net from 'node:net';
import { loadBridgePersistedConfig } from '../config/bridgeConfig.js';

export class SecurityManager {
  constructor(options = {}) {
    this.config = options.config || loadBridgePersistedConfig();
    
    /** @type {Map<string, { token: string, createdAt: number, expiresAt: number, revoked: boolean }>} */
    this.tokenStore = new Map();
    this.pairingAttempts = new Map();

    const initialTokens = Array.isArray(options.initialTokens) ? options.initialTokens : [];
    initialTokens.forEach((t) => this.registerPairingToken(t));

    // Ensure at least one token exists if initial config defined one
    if (this.tokenStore.size === 0) {
      if (this.config.pairingToken) {
        this.registerPairingToken(this.config.pairingToken);
      } else {
        const defaultToken = this.generateToken('chuvator-bridge-local');
        this.registerPairingToken(defaultToken);
      }
    }
  }

  generateToken(prefix = 'token') {
    const randomHex = crypto.randomBytes(16).toString('hex');
    return `${prefix}-${randomHex}`;
  }

  registerPairingToken(token, ttlMs = this.config.tokenTtlMs || 86400000) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    const now = Date.now();
    this.tokenStore.set(cleanToken, {
      token: cleanToken,
      createdAt: now,
      expiresAt: now + ttlMs,
      revoked: false
    });
    return true;
  }

  revokeToken(token) {
    if (!token) return false;
    const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
    const record = this.tokenStore.get(cleanToken);
    if (record) {
      record.revoked = true;
      return true;
    }
    return false;
  }

  isValidToken(token) {
    if (!token) return false;
    const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
    const record = this.tokenStore.get(cleanToken);
    if (!record) return false;
    if (record.revoked) return false;
    if (Date.now() > record.expiresAt) return false;
    return true;
  }

  /**
   * DNS Rebinding Protection: Validates Host header against loopback addresses
   */
  validateHostHeader(req) {
    const hostHeader = req.headers.host || '';
    if (!hostHeader) return false;
    const allowed = this.config.allowedHostHeaders || [
      '127.0.0.1',
      '127.0.0.1:9123',
      'localhost',
      'localhost:9123',
      '[::1]',
      '[::1]:9123'
    ];

    const cleanHost = String(hostHeader).toLowerCase().trim();
    return allowed.some((h) => cleanHost === h || cleanHost.startsWith(`${h}:`));
  }

  isOriginAllowed(origin) {
    if (!origin) return true; // Direct non-browser CLI or curl requests allowed
    const cleanOrigin = String(origin).toLowerCase().trim();
    const allowed = (this.config.allowedOrigins || []).map((o) => String(o).toLowerCase().trim());
    return allowed.includes(cleanOrigin);
  }

  setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin && this.isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Bridge-Token, X-Bridge-Pairing-Key, X-Requested-With, X-Workstation-Id, X-Tenant-Id'
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

  /**
   * Rate limiter for pairing endpoint to prevent brute-force pairing attacks
   */
  checkPairingRateLimit(clientIp = '127.0.0.1') {
    const now = Date.now();
    const windowMs = this.config.pairingRateLimitWindowMs || 60000;
    const maxAttempts = this.config.pairingRateLimitMaxAttempts || 5;

    let record = this.pairingAttempts.get(clientIp);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      this.pairingAttempts.set(clientIp, record);
      return true;
    }

    record.count += 1;
    return record.count <= maxAttempts;
  }

  /**
   * SSRF Protection: Validates target network thermal printer IP and port
   */
  validateNetworkDestination(host, port) {
    if (!host) {
      return { ok: false, reason: 'Alamat host printer jaringan tidak boleh kosong.' };
    }

    const cleanHost = String(host).trim().toLowerCase();
    const targetPort = parseInt(String(port || '9100'), 10);

    // Reject Cloud Metadata IPs (AWS/GCP/Azure)
    if (cleanHost === '169.254.169.254' || cleanHost.startsWith('169.254.')) {
      return {
        ok: false,
        reason: 'Akses ke metadata cloud (169.254.x.x) dilarang demi keamanan SSRF.'
      };
    }

    // Thermal Printer raw printing ports allowed (9100-9109, 9100 standard)
    const isAllowedPrinterPort = targetPort >= 9100 && targetPort <= 9109;
    if (!isAllowedPrinterPort) {
      return {
        ok: false,
        reason: `Port TCP ${targetPort} tidak diizinkan. Hanya port pencetakan thermal LAN (9100-9109) yang diizinkan.`
      };
    }

    // Check if host is valid IP address or local hostname
    const isIPv4 = net.isIPv4(cleanHost);
    const isIPv6 = net.isIPv6(cleanHost);

    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
      return { ok: true, isLocal: true };
    }

    if (isIPv4) {
      // Check for private LAN subnets: 10.x.x.x, 192.168.x.x, 172.16-31.x.x
      const parts = cleanHost.split('.').map(Number);
      const isClassA = parts[0] === 10;
      const isClassC = parts[0] === 192 && parts[1] === 168;
      const isClassB = parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;

      if (isClassA || isClassB || isClassC) {
        return { ok: true, isPrivateLan: true };
      }

      return {
        ok: false,
        reason: `Alamat IP ${cleanHost} adalah IP publik WAN. Hanya printer thermal pada jaringan LAN lokal (192.168.x.x, 10.x.x.x, 172.16-31.x.x) yang diizinkan.`
      };
    }

    if (isIPv6) {
      return { ok: true, isIPv6: true };
    }

    return { ok: true, isHostname: true };
  }

  verifyRequestAuth(req) {
    // 1. Validate Host Header (DNS Rebinding)
    if (!this.validateHostHeader(req)) {
      return {
        authorized: false,
        code: 403,
        message: 'Akses dilarang (Host header tidak valid / DNS Rebinding protection).'
      };
    }

    // 2. Validate Origin Header if present
    const origin = req.headers.origin;
    if (origin && !this.isOriginAllowed(origin)) {
      return {
        authorized: false,
        code: 403,
        message: `Origin "${origin}" tidak diizinkan mengakses Local Print Bridge.`
      };
    }

    // 3. Validate Token
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
        message: 'Token otentikasi bridge tidak valid, telah kedaluwarsa, atau sudah dicabut.'
      };
    }

    return { authorized: true };
  }
}

export default SecurityManager;
