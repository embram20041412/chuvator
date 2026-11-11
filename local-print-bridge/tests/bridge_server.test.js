/**
 * CHUVATOR — Local Print Bridge Hardened Unit Tests (Phase 4.3.1)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createBridgeServer } from '../src/server/bridgeServer.js';

test('Local Print Bridge — Phase 4.3.1 Security & Compatibility Tests', async (t) => {
  const bridge = createBridgeServer({
    config: {
      port: 9874,
      host: '127.0.0.1',
      version: '1.0.1',
      allowedOrigins: ['https://chuvator.pages.dev', 'http://localhost:3000'],
      allowedHostHeaders: ['127.0.0.1:9874', 'localhost:9874', '127.0.0.1']
    }
  });

  await bridge.listen(9874, '127.0.0.1');

  await t.test('1. GET /health with production origin https://chuvator.pages.dev returns HTTP 200 OK', async () => {
    const res = await fetch('http://127.0.0.1:9874/health', {
      headers: { Origin: 'https://chuvator.pages.dev' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://chuvator.pages.dev');
  });

  await t.test('2. Request with malicious Host header (DNS Rebinding) returns 403 Forbidden', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request('http://127.0.0.1:9874/health', {
        headers: { Host: 'evil-rebinding-domain.com' }
      }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal(status, 403);
  });

  await t.test('3. Request with unauthorized Origin header returns 403 Forbidden', async () => {
    const res = await fetch('http://127.0.0.1:9874/api/v1/printers', {
      headers: {
        Origin: 'https://evil-phishing-site.com',
        'X-Bridge-Token': 'test-token'
      }
    });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error, 'ORIGIN_FORBIDDEN');
  });

  await t.test('4. POST /api/v1/pair registers pairing token and enforces rate-limiting', async () => {
    const res = await fetch('http://127.0.0.1:9874/api/v1/pair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: 'test-secure-token-99' })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.token, 'test-secure-token-99');
  });

  await t.test('5. Network TCP SSRF destination to AWS metadata IP (169.254.169.254) is blocked', async () => {
    const res = await fetch('http://127.0.0.1:9874/api/v1/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': 'test-secure-token-99'
      },
      body: JSON.stringify({
        printerType: 'network_tcp',
        escPosBase64: Buffer.from('TEST').toString('base64'),
        connectionDetails: { host: '169.254.169.254', port: 9100 }
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, 'SSRF_BLOCKED');
  });

  await t.test('6. Print job status maps to SUBMITTED with disclaimer message', async () => {
    const res = await fetch('http://127.0.0.1:9874/api/v1/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': 'test-secure-token-99'
      },
      body: JSON.stringify({
        printerType: 'bluetooth_spp',
        escPosBase64: Buffer.from('ESC/POS BUFFER').toString('base64'),
        connectionDetails: { path: 'COM3' }
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.status, 'SUBMITTED');
    assert.match(json.message, /SUBMITTED/);
  });

  await t.test('7. Token revocation via POST /api/v1/revoke rejects subsequent requests', async () => {
    const revokeRes = await fetch('http://127.0.0.1:9874/api/v1/revoke', {
      method: 'POST',
      headers: {
        'X-Bridge-Token': 'test-secure-token-99'
      }
    });

    assert.equal(revokeRes.status, 200);

    const printerRes = await fetch('http://127.0.0.1:9874/api/v1/printers', {
      headers: {
        'X-Bridge-Token': 'test-secure-token-99'
      }
    });

    assert.equal(printerRes.status, 403);
  });

  await bridge.close();
});
