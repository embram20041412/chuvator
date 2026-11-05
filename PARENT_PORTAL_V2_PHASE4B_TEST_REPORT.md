# PARENT PORTAL V2 — FASE 4B
## LAPORAN HASIL PENGUJIEN SKENARIO PEMBAYARAN MANUAL (TEST REPORT)
**Dokumen Test Report:** `PARENT_PORTAL_V2_PHASE4B_TEST_REPORT.md`  
**Status Pengujian:** 22/22 SUBTESTS PASSED (100% PASS RATE)  
**File Executable Test:** `tests/portal_v2_phase4b_manual_payment.test.js`

---

### 1. RINGKASAN HASIL EKSEKUSI PENGUJIEN AUTOMATED

Pengujian dieksekusi menggunakan test runner bawaan Node.js (`node --test tests/portal_v2_phase4b_manual_payment.test.js`):

```
TAP version 13
# Subtest: CHUVATOR Parent Portal V2 — Phase 4B Manual Payment Integration Test Suite
  # Subtest: Category 1: Tenant Payment Configuration & Isolation (Tests 1 - 4)
    ok 1 - Test 1: Parent can read own tenant QRIS static image URL
    ok 2 - Test 2: Parent cannot read another tenant's QRIS info (Strict Tenant Isolation)
    ok 3 - Test 3: Parent can read own tenant bank accounts array
    ok 4 - Test 4: Parent cannot read another tenant's bank accounts
  # Subtest: Category 2: Payment Proof Submission & Validation (Tests 5 - 10)
    ok 1 - Test 5: Parent can submit a valid payment proof (JPG/PNG <= 5MB)
    ok 2 - Test 6: Parent cannot submit file exceeding 5 MB limit
    ok 3 - Test 7: Parent cannot submit disallowed file types (e.g. .exe, .sh, .html)
    ok 4 - Test 8: Parent cannot access another parent's payment proof
    ok 5 - Test 9: Parent cannot tamper with official bill amount
    ok 6 - Test 10: Parent cannot change payment status to LUNAS directly upon upload
  # Subtest: Category 3: Admin & Owner Verification Security & RBAC (Tests 11 - 18)
    ok 1 - Test 11: Parent cannot perform verification
    ok 2 - Test 12: Manager cannot perform verification in Phase 4B
    ok 3 - Test 13: Staff and Kasir cannot perform verification
    ok 4 - Test 14: Admin Tenant can only verify payments for their own tenant
    ok 5 - Test 15: Owner Tenant can only verify payments for their own tenant
    ok 6 - Test 16: Admin/Owner cannot verify an already verified payment (Double Verification Prevented)
    ok 7 - Test 17: Rejection strictly requires notes/reason
    ok 8 - Test 18: Rejected proof does NOT generate a success transaction or ledger entry
  # Subtest: Category 4: Financial Core Integrity & Idempotency (Tests 19 - 22)
    ok 1 - Test 19: Successful verification generates atomic Financial Core records & ledger entries
    ok 2 - Test 20: Idempotency Key payload mismatch detection (GAP-06 Fix)
    ok 3 - Test 21: Concurrent verification by two admins prevented by FOR UPDATE row locking
    ok 4 - Test 22: Parent Portal status follows official Financial Core status accurately
1..1 # tests 22 # pass 22 # fail 0
```

---

### 2. MATRIKS RINCI 22 SKENARIO PENGUJIEN

| ID Test | Deskripsi Skenario Pengujian | Hasil Pengujian | Catatan Keamanan |
| :---: | :--- | :---: | :--- |
| **Test 1** | Parent dapat membaca QRIS statis tenant sendiri | **PASSED** | Mengakses `tenants.qris_url` milik tenant terdaftar. |
| **Test 2** | Parent tidak dapat membaca QRIS tenant lain | **PASSED** | Ditolak via isolasi tenant (`tenant_id` mismatch). |
| **Test 3** | Parent dapat membaca daftar rekening bank tenant sendiri | **PASSED** | Membaca JSONB `tenants.bank_accounts` tenant terdaftar. |
| **Test 4** | Parent tidak dapat membaca rekening bank tenant lain | **PASSED** | Ditolak via isolasi tenant. |
| **Test 5** | Parent dapat mengunggah bukti transfer valid (JPG/PNG <= 5MB) | **PASSED** | Diterima oleh `/api/portal/upload_receipt`. |
| **Test 6** | Parent tidak dapat mengunggah file di atas 5 MB | **PASSED** | Ditolak dengan HTTP `400 Bad Request`. |
| **Test 7** | Parent tidak dapat mengunggah ekstensi file dilarang | **PASSED** | Hanya JPG, JPEG, PNG, WEBP, PDF yang diizinkan. |
| **Test 8** | Parent tidak dapat membaca bukti milik parent lain | **PASSED** | Terlindungi oleh RLS Storage dan otorisasi sesi. |
| **Test 9** | Parent tidak dapat memanipulasi nominal tagihan | **PASSED** | Nominal diambil dari Financial Core DB. |
| **Test 10**| Parent tidak dapat mengubah status menjadi Lunas langsung | **PASSED** | Status diubah menjadi `MENUNGGU VERIFIKASI`. |
| **Test 11**| Parent tidak dapat melakukan verifikasi | **PASSED** | Ditolak dengan HTTP `403 Forbidden`. |
| **Test 12**| Manager tidak dapat melakukan verifikasi pada FASE 4B | **PASSED** | Ditolak (Hanya Owner & Admin yang diizinkan). |
| **Test 13**| Staff dan Kasir tidak dapat melakukan verifikasi | **PASSED** | Ditolak dengan HTTP `403 Forbidden`. |
| **Test 14**| Admin Tenant hanya dapat memverifikasi tenant sendiri | **PASSED** | Ditolak jika mencoba memverifikasi tenant lain. |
| **Test 15**| Owner Tenant hanya dapat memverifikasi tenant sendiri | **PASSED** | Diverifikasi berdasarkan `tenant_id` aktif. |
| **Test 16**| Admin/Owner tidak dapat memverifikasi ulang pembayaran lunas | **PASSED** | Pengujian double verification ditolak. |
| **Test 17**| Penolakan pembayaran wajib menyertakan alasan | **PASSED** | Parameter `notes` / `reason` wajib terisi. |
| **Test 18**| Pembayaran ditolak TIDAK membuat transaksi sukses/ledger | **PASSED** | Status tagihan diubah ke `BELUM_LUNAS`. |
| **Test 19**| Verifikasi sukses membuat entri Financial Core & Ledger | **PASSED** | Jurnal `1002_BANK` vs `4001_REVENUE` seimbang. |
| **Test 20**| Idempotency Key payload mismatch terdeteksi (GAP-06 Fix) | **PASSED** | Re-use key dengan payload berbeda ditolak. |
| **Test 21**| Verifikasi bersamaan oleh 2 Admin dicegah via `FOR UPDATE` | **PASSED** | Baris tagihan dikunci secara *pessimistic*. |
| **Test 22**| Status Portal mengikuti status resmi Financial Core | **PASSED** | Status `UNPAID`, `WAITING`, `VERIFIED`, `REJECTED`. |
