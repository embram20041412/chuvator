/**
 * CHUVATOR — Local Print Bridge Job Queue System (Phase 4.3)
 *
 * Managed FIFO execution queue preventing concurrent port collisions on hardware printers.
 */

import crypto from 'node:crypto';
import BluetoothSppAdapter from '../adapters/BluetoothSppAdapter.js';
import UsbDriverAdapter from '../adapters/UsbDriverAdapter.js';
import NetworkPrinterAdapter from '../adapters/NetworkPrinterAdapter.js';
import OsSpoolerAdapter from '../adapters/OsSpoolerAdapter.js';

export class JobQueueManager {
  constructor(options = {}) {
    this.jobs = new Map();
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
    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const jobRecord = {
      id: jobId,
      status: 'QUEUED',
      printerType: jobData.printerType || 'bluetooth_spp',
      connectionDetails: jobData.connectionDetails || {},
      payload: jobData.payload || null,
      escPosBase64: jobData.escPosBase64 || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null
    };

    this.jobs.set(jobId, jobRecord);
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

    jobRecord.status = 'PRINTING';
    jobRecord.updatedAt = new Date().toISOString();

    try {
      const adapter = this.adapters[jobRecord.printerType] || this.adapters.bluetooth_spp;
      
      // Decode base64 ESC/POS buffer if provided, otherwise convert payload
      let bufferData = null;
      if (jobRecord.escPosBase64) {
        bufferData = Buffer.from(jobRecord.escPosBase64, 'base64');
      } else if (jobRecord.payload?.escPos?.byteArray) {
        bufferData = Buffer.from(jobRecord.payload.escPos.byteArray);
      } else if (jobRecord.payload?.escPosBase64) {
        bufferData = Buffer.from(jobRecord.payload.escPosBase64, 'base64');
      } else {
        // Fallback default test ESC/POS header text buffer
        bufferData = Buffer.from(`\x1b\x40CHUVATOR PRINT BRIDGE\nJob ID: ${jobId}\n\x1d\x56\x41\x00`, 'utf-8');
      }

      const execResult = await adapter.print(
        bufferData,
        jobRecord.connectionDetails
      );

      jobRecord.status = execResult.ok ? 'COMPLETED' : 'FAILED';
      jobRecord.result = execResult;
      jobRecord.updatedAt = new Date().toISOString();
    } catch (err) {
      jobRecord.status = 'FAILED';
      jobRecord.result = {
        ok: false,
        status: 'ERROR',
        message: err.message || 'Error eksekusi job cetak.'
      };
      jobRecord.updatedAt = new Date().toISOString();
    } finally {
      this.isProcessing = false;
      // Continue next job in queue asynchronously
      setImmediate(() => this.processQueue());
    }
  }
}

export default JobQueueManager;
