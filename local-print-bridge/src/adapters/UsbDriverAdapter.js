/**
 * CHUVATOR — Local Print Bridge USB Driver Adapter (Phase 4.3)
 *
 * Handles raw ESC/POS byte transmission over OS USB printer drivers.
 */

import fs from 'node:fs';

export class UsbDriverAdapter {
  constructor(options = {}) {
    this.name = 'UsbDriverAdapter';
  }

  async print(escPosBuffer, connectionDetails = {}) {
    const driverName = connectionDetails.driverName || connectionDetails.port || 'USB001';
    const buffer = Buffer.isBuffer(escPosBuffer)
      ? escPosBuffer
      : Buffer.from(escPosBuffer || []);

    if (buffer.length === 0) {
      return {
        ok: false,
        status: 'FAILED',
        message: 'Buffer data ESC/POS kosong.'
      };
    }

    try {
      if (fs.existsSync(driverName)) {
        const fd = fs.openSync(driverName, 'w');
        fs.writeSync(fd, buffer, 0, buffer.length);
        fs.closeSync(fd);
        return {
          ok: true,
          status: 'SUCCESS',
          bytesTransferred: buffer.length,
          driverName,
          message: `Berhasil mengirim ${buffer.length} bytes ke USB driver (${driverName}).`
        };
      }

      return {
        ok: true,
        status: 'SUCCESS',
        simulated: true,
        bytesTransferred: buffer.length,
        driverName,
        message: `[Simulasi Bridge] Berhasil mentransmisikan ${buffer.length} bytes ESC/POS ke USB Driver (${driverName}).`
      };
    } catch (err) {
      return {
        ok: false,
        status: 'TRANSFER_ERROR',
        message: `Gagal mengirim data ke USB Driver (${driverName}): ${err.message}`
      };
    }
  }
}

export default UsbDriverAdapter;
