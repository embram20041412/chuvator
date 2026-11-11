# CHUVATOR — Local Print Bridge Service (Phase 4.3)

Layanan pendamping lokal (Local Companion Service) untuk **CHUVATOR Central Receipt & Printing System**.

## 1. TUJUAN & LINGKUP

Local Print Bridge berjalan sebagai layanan latar belakang (background daemon) di komputer kasir/workstation (`http://127.0.0.1:9123`) untuk menghubungkan aplikasi web Chuvator dengan printer yang tidak dapat diakses secara langsung oleh browser web melalui API WebUSB atau Web Bluetooth:

1. **Bluetooth Classic (SPP / Serial Port Profile)** — Printer thermal portabel legacy.
2. **Printer USB Sistem Operasi (OS Driver / Windows Spooler / CUPS)** — Printer thermal USB yang sudah dikuasai driver OS (WinUSB tidak diinstal).
3. **Printer Jaringan TCP/IP (Port 9100)** — Printer thermal LAN / Wi-Fi kasir.
4. **OS Print Spooler (Inkjet / Ink Tank / Laser)** — Pencetakan bukti A4/A5 secara silent tanpa menampilkan dialog cetak browser.

---

## 2. ARSITEKTUR KEAMANAN

Layanan ini dirancang dengan pengamanan ketat untuk mencegah SSRF (Server-Side Request Forgery) dan eksekusi perintah tak terotorisasi dari situs web berbahaya:

- **Strict Localhost Binding**: Server hanya mendengarkan alamat loopback `127.0.0.1`.
- **Token-Based Authentication**: Seluruh endpoint API selain `/health` membutuhkan header HTTP `X-Bridge-Token` atau `Authorization: Bearer <token>`.
- **CORS & Origin Validation**: Hanya mengizinkan origin terdaftar (`https://app.chuvator.com`, `http://localhost:3000`).
- **Payload & Rate Limiting**: Batas payload maksimal 2MB per job dan antrean FIFO terlindungi.

---

## 3. CARA MENJALANKAN

### Persyaratan System
- Node.js v18.0.0 atau lebih baru

### Mulaikan Server
```bash
cd local-print-bridge
npm start
```

Default listening port: `9123` (Alamat HTTP: `http://127.0.0.1:9123`).

---

## 4. CONTRACT API ENDPOINTS

- `GET /health` — Memeriksa status kesehatan bridge.
- `POST /api/v1/pair` — Melakukan pairing token awal antara browser dan bridge.
- `GET /api/v1/printers` — Memindai printer lokal yang terhubung (Bluetooth SPP, USB, Network, OS Spooler).
- `GET /api/v1/status` — Memeriksa status antrean dan koneksi printer.
- `POST /api/v1/print` — Mengirimkan dokumen cetak (ESC/POS binary base64 atau payload normalisasi).
- `GET /api/v1/jobs/:jobId` — Memeriksa status pekerjaan cetak berdasarkan ID.
