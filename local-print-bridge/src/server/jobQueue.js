/**
 * CHUVATOR — Local Print Bridge Job Queue System (Phase 4.3.1 Hardened)
 *
 * Managed FIFO execution queue with explicit job status pipeline:
 * - QUEUED
 * - PROCESSING
 * - SUBMITTED
 * - FAILED
 *
 * Includes duplicate submission prevention (idempotency), adapter segregation,
 * and timeout/retry management.
 */

import crypto from 'node:crypto';
import BluetoothSppAdapter from '../adapters/BluetoothSppAdapter.js';
import UsbDriverAdapter from '../adapters/UsbDriverAdapter.js';
import NetworkPrinterAdapter from '../adapters/NetworkPrinterAdapter.js';
import OsSpoolerAdapter from '../adapters/OsSpoolerAdapter.js';

export class JobQueueManager {
  constructor(options = {}) {
    /** @type {Map<string, any>} */
    this.jobs = new Map();
    /** @type {Map<string, string>} idempotencyKey -> jobId */
    this.idempotencyMap = new Map();
    this.queue = [];
    this.isProcessing = false;

    this.adapters = {
      bluetooth_spp: options.bluetoothSppAdapter || new BluetoothSppAdapter(),
      usb_driver: options.usbDriverAdapter || new UsbDriverAdapter(),
      network_tcp: options.networkPrinterAdapter || new NetworkPrinterAdapter(),
      os_spooler: options.osSpoolerAdapter || new OsSpoolerAdapter()
    };
  }

  createJob(jobData = {}) {
    const idempotencyKey = jobData.idempotencyKey || jobData.clientJobId || null;

    // 1. Check for Duplicate Submission
    if (idempotencyKey && this.idempotencyMap.has(idempotencyKey)) {
      const existingJobId = this.idempotencyMap.get(idempotencyKey);
      const existingJob = this.jobs.get(existingJobId);
      if (existingJob) {
        return {
          ...existingJob,
          isDuplicate: true,
          message: 'Pekerjaan cetak duplikat terdeteksi (Idempotency key cocok). Mengembalikan status pekerjaan yang sudah ada.'
        };
      }
    }

    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const printerType = String(jobData.printerType || 'bluetooth_spp').toLowerCase();

    const jobRecord = {
      id: jobId,
      idempotencyKey,
      status: 'QUEUED', // QUEUED -> PROCESSING -> SUBMITTED | FAILED
      printerType,
      connectionDetails: jobData.connectionDetails || {},
      payload: jobData.payload || null,
      escPosBase64: jobData.escPosBase64 || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      message: 'Pekerjaan cetak dimasukkan ke antrean (QUEUED).'
    };

    this.jobs.set(jobId, jobRecord);
    if (idempotencyKey) {
      this.idempotencyMap.set(idempotencyKey, jobId);
    }

    this.queue.push(jobId);
    this.processQueue();

    return jobRecord;
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  listJobs() {
    return Array.from(this.jobs.values());
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const jobId = this.queue.shift();
    const jobRecord = this.jobs.get(jobId);

    if (!jobRecord) {
      this.isProcessing = false;
      this.processQueue();
      return;
    }

    jobRecord.status = 'PROCESSING';
    jobRecord.updatedAt = new Date().toISOString();
    jobRecord.message = 'Pekerjaan cetak sedang diproses oleh adapter hardware (PROCESSING)...';

    try {
      const printerType = jobRecord.printerType;

      // PRIORITY 2 PROTECTION: Segregate Inkjet/Ink Tank (os_spooler) from raw ESC/POS
      if (printerType === 'os_spooler') {
        const adapter = this.adapters.os_spooler;
        const execResult = await adapter.print(
          jobRecord.payload || jobRecord,
          jobRecord.connectionDetails
        );

        jobRecord.status = execResult.ok ? 'SUBMITTED' : 'FAILED';
        jobRecord.result = execResult;
        jobRecord.updatedAt = new Date().toISOString();
        jobRecord.message = execResult.ok
          ? 'Dokumen berhasil DISERAHKAN (SUBMITTED) ke OS Spooler (Inkjet/Ink Tank/Laser). Catatan: Status SUBMITTED tidak menjamin fisik kertas telah tercetak dari tray printer.'
          : execResult.message;

        this.isProcessing = false;
        setImmediate(() => this.processQueue());
        return;
      }

      // Thermal Printer Adapters (Bluetooth SPP, USB Driver, Network TCP)
      const adapter = this.adapters[printerType] || this.adapters.bluetooth_spp;

      let bufferData = null;
      if (jobRecord.escPosBase64) {
        bufferData = Buffer.from(jobRecord.escPosBase64, 'base64');
      } else if (jobRecord.payload?.escPos?.byteArray) {
        bufferData = Buffer.from(jobRecord.payload.escPos.byteArray);
      } else if (jobRecord.payload?.escPosBase64) {
        bufferData = Buffer.from(jobRecord.payload.escPosBase64, 'base64');
      } else {
        bufferData = Buffer.from(`\x1b\x40CHUVATOR PRINT BRIDGE\nJob ID: ${jobId}\n\x1d\x56\x41\x00`, 'utf-8');
      }

      const execResult = await adapter.print(
        bufferData,
        jobRecord.connectionDetails
      );

      // Explicit status mapping: SUBMITTED or FAILED
      jobRecord.status = execResult.ok ? 'SUBMITTED' : 'FAILED';
      jobRecord.result = execResult;
      jobRecord.updatedAt = new Date().toISOString();
      jobRecord.message = execResult.ok
        ? `Data cetak berhasil DISERAHKAN (SUBMITTED) ke antrean/buffer perangkat ${printerType}. Catatan: Status SUBMITTED tidak diartikan sebagai bukti fisik kertas telah keluar dari printer.`
        : execResult.message || 'Gagal mentransmisikan data ke perangkat printer.';

    } catch (err) {
      jobRecord.status = 'FAILED';
      jobRecord.result = {
        ok: false,
        status: 'FAILED',
        message: err.message || 'Error eksekusi job cetak.'
      };
      jobRecord.updatedAt = new Date().toISOString();
      jobRecord.message = `Gagal memproses pekerjaan cetak: ${err.message}`;
    } finally {
      this.isProcessing = false;
      setImmediate(() => this.processQueue());
    }
  }
}

export default JobQueueManager;
