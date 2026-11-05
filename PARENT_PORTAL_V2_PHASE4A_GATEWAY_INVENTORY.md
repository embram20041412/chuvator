# PARENT PORTAL V2 — FASE 4A
## AUDIT LENGKAP INVENTARISASI PAYMENT GATEWAY
**Dokumen Spec & Audit:** `PARENT_PORTAL_V2_PHASE4A_GATEWAY_INVENTORY.md`  
**Status Mode:** STRICT READ-ONLY AUDIT  
**Target Project:** `wqnhlmvvyhpctmaukwyj.supabase.co` (CHUVATOR / CHUA CORE)

---

### 1. HASIL UTAMA AUDIT (CORE FINDING STATEMENT)

```
===============================================================================
               NO EXISTING PAYMENT GATEWAY VERIFIED
===============================================================================
```

Berdasarkan inspeksi statis dan dinamis terhadap seluruh repositori source code CHUVATOR (frontend, backend Edge Pages Functions, konfigurasi `package.json`, dan file lingkungan `.env.example`), **TIDAK DITEMUKAN ADANYA INTEGRASI PAYMENT GATEWAY AKTIF** (seperti Midtrans, Xendit, Stripe, TriPay, atau Doku).

---

### 2. BUKTI VERIFIKASI REPOSITORI & ENVIRONMENT

#### A. Dependensi & SDK (`package.json`)
- **Hasil Inspeksi**: File `package.json` tidak memiliki SDK payment gateway pihak ketiga (misalnya `midtrans-client`, `xendit-node`, `stripe`, `@paypal/react-paypal-js`).
- **Dependensi Terkait Pembayaran**: Hanya ditemukan `react-qr-code` (`^2.2.0`) yang digunakan untuk merender gambar QRIS statis / teks QR pada komponen modal.

#### B. Variabel Lingkungan & Secret Keys (`.env.example`)
- **Hasil Inspeksi**: File `.env.example` hanya berisi konfigurasi Supabase, Firebase, dan Cloudflare Pages Functions.
- **Secret Keys Payment Gateway**:
  - `MIDTRANS_SERVER_KEY`: **TIDAK ADA**
  - `MIDTRANS_CLIENT_KEY`: **TIDAK ADA**
  - `XENDIT_SECRET_KEY`: **TIDAK ADA**
  - `XENDIT_WEBHOOK_VERIFICATION_TOKEN`: **TIDAK ADA**

#### C. Endpoint Backend Edge (`/functions/api/portal/`)
- **Hasil Inspeksi Handler**:
  - `/functions/api/portal/billing.js`: Hanya membaca data tagihan SPP dan informasi rekening/QRIS statis dari dokumen tenant.
  - Endpoint inisiasi pembayaran daring (`/api/portal/payment/initiate`): **TIDAK ADA**.
  - Endpoint handler webhook/callback (`/api/portal/payment/webhook`): **TIDAK ADA**.

#### D. Mekanisme Pembayaran Saat Ini
Sistem saat ini sepenuhnya mengandalkan:
1. **QRIS Statis**: Gambar QRIS arena/tenant yang diunggah oleh pengelola melalui halaman Pengaturan (`tenants.qris_url` / `qris_image_base64`).
2. **Transfer Bank Manual**: Tampilan read-only nomor rekening dan nama pemilik rekening bank cabang yang disajikan dalam komponen `SppPaymentModal.jsx`, `PaymentGatewayModal.jsx`, dan `PortalDashboard.jsx`.

---

### 3. REKOMENDASI DAN EVALUASI PROVIDER PAYMENT GATEWAY

Untuk mendukung **FASE 4B (Integrated Payment Implementation)**, berikut adalah evaluasi dan perbandingan calon provider payment gateway yang direkomendasikan untuk CHUVATOR:

| Kriteria Evaluasi | Midtrans (Snap & Core API) | Xendit (Invoices & QRIS API) |
| :--- | :--- | :--- |
| **Model Integrasi** | Snap Popup / Redirect & Core API | Invoice UI / Direct API & QRIS |
| **Dukungan QRIS** | QRIS Dinamis (GOPAY, ShopeePay, QRIS BCA) | QRIS Dinamis (Asosiasi QRIS) |
| **Virtual Account (VA)** | BCA, Mandiri, BNI, BRI, Permata, CIMB | BCA, Mandiri, BNI, BRI, Permata |
| **Mekanisme Webhook** | HTTP POST Notification dengan SHA-512 Signature | HTTP POST dengan Token Verifikasi Header |
| **Kecepatan Settlement** | T+1 hari kerja | T+1 hari kerja |
| **Biaya per Transaksi** | ~0.7% (QRIS), Rp 4.000 (VA) | ~0.7% (QRIS), Rp 4.500 (VA) |
| **Rekomendasi Utama** | **SANGAT DIREKOMENDASIKAN** (Dukungan Snap UI mobile-friendly) | **DIREKOMENDASIKAN** (Dokumentasi API yang sangat bersih) |

---

### 4. KEBUTUHAN PRASYARAT SEBELUM FASE 4B

Sebelum FASE 4B dimulai, Product Owner wajib menentukan dan menyediakan:
1. Keputusan resmi pemilihan provider (Midtrans / Xendit).
2. Pendaftaran akun Merchant & Perolehan API Keys (Sandbox & Production).
3. Pemasangan SDK resmi pada `package.json`.
4. Konfigurasi webhook URL pada dashboard Merchant Gateway mengarah ke domain resmi portal (`https://portal.chuvator.id/api/portal/payment/webhook`).
