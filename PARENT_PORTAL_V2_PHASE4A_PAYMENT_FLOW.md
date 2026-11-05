# PARENT PORTAL V2 — FASE 4A
## RANCANGAN ALUR PEMBAYARAN TERINTEGRASI (INTEGRATED PAYMENT FLOW)
**Dokumen Spec & Flow:** `PARENT_PORTAL_V2_PHASE4A_PAYMENT_FLOW.md`  
**Status Mode:** ARCHITECTURE & SEQUENCE SPECIFICATION  
**Target Project:** CHUVATOR Parent Portal V2

---

### 1. ALUR SEQUENCE PEMBAYARAN 13-LANGKAH

Berikut adalah rancangan alur sequence pembayaran daring terintegrasi dari inisiasi hingga settlement final:

```
[ Parent Browser ]      [ Edge API / Inisiasi ]     [ Financial Core DB ]     [ Payment Gateway ]     [ Edge API / Webhook ]
        |                         |                         |                          |                         |
 1. Login & Pilih Anak ---------> |                         |                          |                         |
 2. Lihat Tagihan SPP ----------> | Read-Only Query ------> |                          |                         |
 3. Klik "Bayar Daring" --------> |                         |                          |                         |
 4. Request Inisiasi ------------>| Verify Session & Auth ->|                          |                         |
        |                         | Read Official Amount -> |                          |                         |
        |                         | Create Order (Pending)->|                          |                         |
        |                         | Call Gateway API --------------------------------->|                         |
        | <----------------------- Return Snap / Payment URL --------------------------|                         |
 5. Lakukan Pembayaran (QRIS/VA) - - - - - - - - - - - - - - - - - - - - - - - - - - ->|                         |
        |                         |                         |                          | 6. Send Webhook Notification -->|
        |                         |                         |                          |                         | Verify Signature (HMAC)
        |                         |                         |                          |                         | Call Settlement RPC
        |                         |                         | <--- Execute Settlement - - - - - - - - - - - - - -|
        |                         |                         | (LUNAS & Journal Ledger) |                         |
 7. Read Final Status ------------> Read Official Status -> |                          |                         |
```

---

### 2. DOKUMENTASI DETIL 13 LANGKAH IMPLEMENTASI

| Langkah | Deskripsi Operasional | Komponen Terlibat | Status Kesiapan Komponen |
| :---: | :--- | :--- | :---: |
| **1** | Parent melakukan autentikasi masuk ke Portal. | `functions/api/portal/v2/login.js` | **AVAILABLE** |
| **2** | Parent memilih profil anak via Multi-Child Switcher. | `src/pages/Portal/PortalDashboard.jsx` | **AVAILABLE** |
| **3** | Parent melihat rincian tagihan SPP berjalan. | `/api/portal/billing` | **AVAILABLE** |
| **4** | Parent memilih tagihan & menekan tombol "Bayar Daring". | `PortalDashboard.jsx` Modal | **AVAILABLE** |
| **5** | Client mengirim request inisiasi ke Edge API. | `/api/portal/payment/initiate` | **GAP (FASE 4B)** |
| **6** | Server Edge memverifikasi sesi & hak akses `parent_student_links`. | `_auth_v2.js` | **AVAILABLE** |
| **7** | Server Edge membaca nominal resmi dari Financial Core. | `spp_payments` table | **AVAILABLE** |
| **8** | Server Edge membuat transaksi order pending & meminta Snap token. | RPC `parent_initiate_online_spp_payment` | **GAP (FASE 4B)** |
| **9** | Gateway memproses pembayaran via QRIS Dinamis atau VA. | Provider SDK (Midtrans/Xendit) | **GAP (FASE 4B)** |
| **10** | Gateway mengirimkan notifikasi Webhook setelah sukses. | `/api/portal/payment/webhook` | **GAP (FASE 4B)** |
| **11** | Webhook handler memverifikasi SHA-512 signature & ID transaksi. | Webhook Signature Verifier | **GAP (FASE 4B)** |
| **12** | Financial Core mengeksekusi pelunasan otomatis secara idempotent. | RPC `online_payment_webhook_settle_atomic` | **GAP (FASE 4B)** |
| **13** | Portal membaca status final `'LUNAS'` dari Financial Core. | `/api/portal/billing` | **AVAILABLE** |

---

### 3. PRINSIP KEAMANAN ALUR PEMBAYARAN

- **TIDAK ADA PERUBAHAN STATUS VIA REDIRECT BROWSER**: Redirect halaman sukses dari gateway hanya berfungsi sebagai pembaruan tampilan sementara. Status pembayaran `'LUNAS'` yang sah **HANYA BERASAL DARI VERIFIKASI WEBHOOK RESMI DAN RPC SETTLEMENT ATOMIC IN FINANCIAL CORE**.
- **TIMEOUT & RECONCILIATION**: Jika webhook gagal terkirim (misalnya akibat gangguan jaringan), Cron Job rekonsiliasi berkala akan mengecek status transaksi ke API Gateway secara otomatis.
