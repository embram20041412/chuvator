/**
 * CHUVATOR — Local Print Bridge Unit Tests (Phase 4.3)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeServer } from '../src/server/bridgeServer.js';

test('Local Print Bridge - Server Lifecycle & Health Check', async (t) => {
  const bridge = createBridgeServer({
    config: { port: 9876, host: '127.0.0.1', version: '1.0.0', allowedOrigins: ['*'] }
  });

  await bridge.listen(9876, '127.0.0.1');

  await t.test('GET /health returns HTTP 200 OK', async () => {
    const res = await fetch('http://127.0.0.1:9876/health');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.status, 'ONLINE');
    assert.equal(json.requireAuth, true);
  });

  await t.test('GET /api/v1/printers without token returns 401 Unauthorized', async () => {
    const res = await fetch('http://127.0.0.1:9876/api/v1/printers');
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.error, 'UNAUTHORIZED');
  });

  await t.test('POST /api/v1/pair registers new pairing token', async () => {
    const res = await fetch('http://127.0.0.1:9876/api/v1/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test-pairing-token-123' })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.token, 'test-pairing-token-123');
  });

  await t.test('GET /api/v1/printers with valid X-Bridge-Token returns printer list', async () => {
    const res = await fetch('http://127.0.0.1:9876/api/v1/printers', {
      headers: { 'X-Bridge-Token': 'test-pairing-token-123' }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.printers));
    assert.ok(json.printers.length > 0);
  });

  await t.test('POST /api/v1/print queues and executes print job', async () => {
    const res = await fetch('http://127.0.0.1:9876/api/v1/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': 'test-pairing-token-123'
      },
      body: JSON.stringify({
        printerType: 'bluetooth_spp',
        escPosBase64: Buffer.from('TEST ESC/POS DATA').toString('base64'),
        connectionDetails: { path: 'COM3' }
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(json.jobId);
  });

  await bridge.close();
});
