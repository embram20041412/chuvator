/**
 * CHUVATOR — Local Print Bridge HTTP Server (Phase 4.3.1 Hardened)
 *
 * Lightweight, robust HTTP server running locally at http://127.0.0.1:9123
 */

import http from 'node:http';
import SecurityManager from '../security/securityManager.js';
import LocalPrinterDiscovery from '../discovery/printerDiscovery.js';
import JobQueueManager from '../server/jobQueue.js';
import { loadBridgePersistedConfig } from '../config/bridgeConfig.js';

export function createBridgeServer(options = {}) {
  const config = options.config || loadBridgePersistedConfig();
  const security = options.security || new SecurityManager({ config });
  const discovery = options.discovery || new LocalPrinterDiscovery();
  const jobQueue = options.jobQueue || new JobQueueManager({ security });

  const server = http.createServer(async (req, res) => {
    // 1. Set Security & CORS Headers
    security.setCorsHeaders(req, res);

    // 2. Handle Preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Helper to send JSON response
    const sendJson = (statusCode, payload) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    // 3. DNS REBINDING PROTECTION: Validate Host Header on ALL Requests
    if (!security.validateHostHeader(req)) {
      return sendJson(403, {
        ok: false,
        error: 'INVALID_HOST',
        message: 'Akses dilarang. Host header tidak valid (DNS Rebinding Protection).'
      });
    }

    // 4. ORIGIN VALIDATION: Validate Origin Header if present
    const origin = req.headers.origin;
    if (origin && !security.isOriginAllowed(origin)) {
      return sendJson(403, {
        ok: false,
        error: 'ORIGIN_FORBIDDEN',
        message: `Origin "${origin}" tidak diizinkan mengakses Local Print Bridge.`
      });
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1:9123'}`);
    const pathname = url.pathname;

    // Helper to parse JSON request body
    const parseBody = () =>
      new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > config.maxPayloadSizeBytes) {
            req.destroy();
          }
        });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            resolve({});
          }
        });
      });

    // -------------------------------------------------------------
    // ROUTE 1: GET /health (Public Unauthenticated Health Endpoint)
    // -------------------------------------------------------------
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/v1/health')) {
      return sendJson(200, {
        ok: true,
        service: 'Chuvator Local Print Bridge',
        version: config.version,
        status: 'ONLINE',
        host: config.host,
        port: config.port,
        requireAuth: true
      });
    }

    // -------------------------------------------------------------
    // ROUTE 2: POST /api/v1/pair (Initial Pairing Endpoint with Rate Limiting)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/pair') {
      const clientIp = req.socket?.remoteAddress || '127.0.0.1';
      if (!security.checkPairingRateLimit(clientIp)) {
        return sendJson(429, {
          ok: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Batas percobaan pairing terlampaui. Coba lagi dalam 1 menit.'
        });
      }

      const body = await parseBody();
      const requestedToken = body.token || security.generateToken('chuvator-bridge');
      security.registerPairingToken(requestedToken);

      return sendJson(200, {
        ok: true,
        message: 'Pairing token berhasil didaftarkan.',
        token: requestedToken,
        pairedAt: new Date().toISOString(),
        expiresInSeconds: Math.floor((config.tokenTtlMs || 86400000) / 1000)
      });
    }

    // -------------------------------------------------------------
    // ROUTE 3: POST /api/v1/revoke (Token Revocation Endpoint)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/revoke') {
      const token = security.extractToken(req);
      if (!token) {
        return sendJson(401, {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Token otentikasi bridge tidak ditemukan.'
        });
      }
      security.revokeToken(token);
      return sendJson(200, {
        ok: true,
        message: 'Token otentikasi bridge berhasil dicabut (revoked).'
      });
    }

    // -------------------------------------------------------------
    // AUTHENTICATION GUARD FOR RESTRICTED API ENDPOINTS
    // -------------------------------------------------------------
    const authCheck = security.verifyRequestAuth(req);
    if (!authCheck.authorized) {
      return sendJson(authCheck.code, {
        ok: false,
        error: 'UNAUTHORIZED',
        message: authCheck.message
      });
    }

    // -------------------------------------------------------------
    // ROUTE 4: GET /api/v1/printers (Printer Discovery)
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/v1/printers') {
      try {
        const printers = await discovery.discoverAllPrinters();
        return sendJson(200, {
          ok: true,
          count: printers.length,
          printers,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        return sendJson(500, {
          ok: false,
          error: 'DISCOVERY_FAILED',
          message: err.message
        });
      }
    }

    // -------------------------------------------------------------
    // ROUTE 5: GET /api/v1/status (Bridge & Queue Status)
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/v1/status') {
      return sendJson(200, {
        ok: true,
        status: 'ONLINE',
        activeJobsCount: jobQueue.queue.length,
        totalJobsLogged: jobQueue.jobs.size,
        timestamp: new Date().toISOString()
      });
    }

    // -------------------------------------------------------------
    // ROUTE 6: POST /api/v1/print (Print Job Submission)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/print') {
      const body = await parseBody();
      if (!body || (!body.escPosBase64 && !body.payload && !body.thermalLines)) {
        return sendJson(400, {
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'Payload tidak valid. Sertakan escPosBase64 atau payload dokumen.'
        });
      }

      // Priority 2 Check: Network TCP SSRF Pre-validation
      if (body.printerType === 'network_tcp' && body.connectionDetails) {
        const { host, port } = body.connectionDetails;
        const netCheck = security.validateNetworkDestination(host, port);
        if (!netCheck.ok) {
          return sendJson(400, {
            ok: false,
            error: 'SSRF_BLOCKED',
            message: `Tujuan printer jaringan ditolak: ${netCheck.reason}`
          });
        }
      }

      const jobRecord = jobQueue.createJob({
        idempotencyKey: body.idempotencyKey || body.clientJobId || null,
        printerType: body.printerType || 'bluetooth_spp',
        connectionDetails: body.connectionDetails || {},
        payload: body.payload || null,
        escPosBase64: body.escPosBase64 || null
      });

      // Wait briefly for job execution transition
      await new Promise((r) => setTimeout(r, 100));
      const latestStatus = jobQueue.getJobStatus(jobRecord.id);

      return sendJson(200, {
        ok: true,
        jobId: jobRecord.id,
        status: latestStatus ? latestStatus.status : 'QUEUED',
        message: latestStatus ? latestStatus.message : 'Pekerjaan cetak berhasil diterima dan dimasukkan ke antrean.',
        job: latestStatus
      });
    }

    // -------------------------------------------------------------
    // ROUTE 7: GET /api/v1/jobs/:jobId (Job Status Inquiry)
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname.startsWith('/api/v1/jobs/')) {
      const jobId = pathname.split('/').pop();
      const job = jobQueue.getJobStatus(jobId);
      if (!job) {
        return sendJson(404, {
          ok: false,
          error: 'JOB_NOT_FOUND',
          message: `Job dengan ID "${jobId}" tidak ditemukan.`
        });
      }
      return sendJson(200, {
        ok: true,
        job
      });
    }

    // Fallthrough 404
    return sendJson(404, {
      ok: false,
      error: 'NOT_FOUND',
      message: 'Endpoint API tidak ditemukan.'
    });
  });

  return {
    server,
    security,
    discovery,
    jobQueue,
    listen: (port = config.port, host = config.host) =>
      new Promise((resolve) => {
        server.listen(port, host, () => {
          resolve({ port, host });
        });
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}

export default createBridgeServer;
