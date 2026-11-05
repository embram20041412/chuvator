# PARENT PORTAL V2 — FASE 4A
## RENCANA IMPLEMENTASI FASE 4B & REKOMENDASI FINAL GATE
**Dokumen Spec & Plan:** `PARENT_PORTAL_V2_PHASE4A_IMPLEMENTATION_PLAN.md`  
**Status Mode:** IMPLEMENTATION ROADMAP & GATE SPECIFICATION  
**Target Project:** CHUVATOR Parent Portal V2

---

### 1. URUTAN TAHAP EKSEKUSI FASE 4B (5 TAHAP TERKONTROLI)

Setelah memperoleh persetujuan tertulis dari Product Owner, FASE 4B wajib dilaksanakan mengikuti 5 tahap berurutan:

```
[ Tahap 1: Konfigurasi Provider ] ---> [ Tahap 2: Deployment RPC Online ] ---> [ Tahap 3: Backend Edge API ]
                                                                                         |
[ Tahap 5: Verification & Gate ] <--- [ Tahap 4: Frontend Modal Integration ] <----------+
```

#### TAHAP 1: Keputusan PO & Konfigurasi Provider (Prasyarat)
- Product Owner menetapkan provider payment gateway resmi (Midtrans Snap / Xendit).
- Pemasangan dependensi SDK resmi pada `package.json` (`midtrans-client`).
- Pemasangan variabel rahasia pada environment Cloudflare Pages Functions (`MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `ENVIRONMENT=sandbox`).

#### TAHAP 2: Deployment Perbaikan GAP-06 & RPC Pembayaran Daring
- Eksekusi SQL migration terpisah untuk menembak perbaikan GAP-06 pada `pos_checkout_spp_atomic`.
- Deployment 2 RPC daring baru:
  1. `parent_initiate_online_spp_payment`
  2. `online_payment_webhook_settle_atomic`

#### TAHAP 3: Pembangunan Edge API Handlers
- Pembangunan `/functions/api/portal/payment/initiate.js`:
  - Otorisasi sesi V2, pembacaan nominal resmi dari Financial Core, pembuatan order ID, pendaftaran ke API Gateway Snap, dan pengembalian `snap_token` / `redirect_url`.
- Pembangunan `/functions/api/portal/payment/webhook.js`:
  - Verifikasi signature HMAC SHA-512, penanganan status `settlement` / `capture` / `expire`, pemanggilan RPC `online_payment_webhook_settle_atomic` secara idempotent.

#### TAHAP 4: Integrasi Frontend Modal Pembayaran
- Pembaruan modal pembayaran pada `PortalDashboard.jsx`:
  - Penambahan tombol "Bayar Daring (QRIS / VA Automatis)" yang memicu Snap Popup Midtrans di dalam portal.
  - Penanganan callback Snap (`onSuccess`, `onPending`, `onError`, `onClose`) untuk memperbarui tampilan UI secara dinamis.

#### TAHAP 5: Pengujian Sandbox & End-to-End Security Verification
- Pengujian transaksi simulasi pada Midtrans Simulator (BCA VA, QRIS Simulator).
- Verifikasi bahwa webhook berhasil mengubah status tagihan menjadi `'LUNAS'` di Financial Core secara otomatis.
- Verifikasi proteksi terhadap amount tampering, duplicate webhook, dan replay attack.

---

### 2. REKOMENDASI KEPUTUSAN FINAL GATE FASE 4A

```
===============================================================================
             STATUS FINAL GATE: CONDITIONALLY READY FOR PHASE 4B
===============================================================================
```

#### ALASAN KEPUTUSAN GATE:
1. **Fase 1, 2, dan 3 PASSED**: Arsitektur Parent Portal, Autentikasi V2, dan Parent Dashboard 10 kelompok informasi telah berjalan 100% aman dan terverifikasi.
2. **Gateway Inventory Done**: Terkonfirmasi `NO EXISTING PAYMENT GATEWAY VERIFIED`. Kebutuhan provider telah teridentifikasi secara presisi.
3. **Financial Core Readiness Verified**: Skema database Financial Core sudah siap, dan kebutuhan 2 RPC online baru telah dispesifikasikan.
4. **Kondisi Prasyarat Membutuhkan Keputusan PO**: Sebelum FASE 4B dapat mengeksekusi kode, Product Owner wajib memilih provider (Midtrans / Xendit) dan menyediakan API Keys Sandbox.

---
*Laporan FASE 4A Selesai. Seluruh pekerjaan dihentikan. Tidak ada perubahan kode, DDL/DML, atau deployment yang dilakukan selama FASE 4A.*
