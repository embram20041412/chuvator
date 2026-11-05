# PARENT PORTAL V2 — FASE 4A
## AUDIT KONFIGURASI METODE PEMBAYARAN TENANT (TENANT PAYMENT METHODS)
**Dokumen Spec & Audit:** `PARENT_PORTAL_V2_PHASE4A_TENANT_PAYMENT_METHODS.md`  
**Status Mode:** STRICT READ-ONLY AUDIT  
**Target Project:** `wqnhlmvvyhpctmaukwyj.supabase.co`

---

### 1. HASIL AUDIT TABEL DAN KOLOM KONFIGURASI TENANT

Berdasarkan inspeksi repositori pada file `supabase_migration.sql`, `01_phase2b3_schema_migration.sql`, `PengaturanPage.jsx`, dan `/functions/api/portal/billing.js`:

| Nama Komponen | Lokasi File / Objek Database | Nama Kolom / Field | Tipe Data | Status Implementation |
| :--- | :--- | :--- | :---: | :---: |
| **Tabel Tenant** | Database Table: `tenants` | `id` / `tenant_id` | TEXT / UUID | **DEPLOYED (PROD)** |
| **QRIS Statis URL** | Table: `tenants` | `qris_url` | TEXT | **DEPLOYED (PROD)** |
| **QRIS Base64** | Table: `tenants` | `qris_image_base64` | TEXT | **DEPLOYED (PROD)** |
| **Multi-Rekening Bank** | Table: `tenants` | `bank_accounts` | JSONB | **DEPLOYED (PROD)** |
| **Bank Utama** | Table: `tenants` | `bank_name` | TEXT | **DEPLOYED (PROD)** |
| **No Rekening Utama** | Table: `tenants` | `bank_account_number` | TEXT | **DEPLOYED (PROD)** |
| **Nama Pemilik Rekening**| Table: `tenants` | `bank_account_name` | TEXT | **DEPLOYED (PROD)** |

---

### 2. PENGELOLAAN KONFIGURASI OLEH ADMIN & OWNER TENANT

Pengaturan metode pembayaran dikelola secara terisolasi oleh Admin/Owner tenant melalui halaman Pengaturan (`src/pages/PengaturanPage.jsx`):
- **Upload QRIS Statis**: Pengelola dapat mengunggah gambar QRIS arena yang disimpan pada kolom `qris_url` / `qris_image_base64`.
- **Daftar Rekening Bank**: Pengelola dapat menambah, mengubah, atau menghapus daftar rekening bank dalam skema JSONB `bank_accounts`:
  ```json
  [
    {
      "bankName": "BCA",
      "accountNumber": "1234567890",
      "accountName": "CHUA SPORT CORE CABANG UTAMA"
    },
    {
      "bankName": "MANDIRI",
      "accountNumber": "0987654321",
      "accountName": "CHUA SPORT CORE CABANG UTAMA"
    }
  ]
  ```

---

### 3. AUDIT ISOLASI TENANT & HAK AKSES (TENANT ISOLATION)

1. **Aturan Pembacaan Portal**:
   - Backend Edge `/functions/api/portal/billing.js` membaca data tenant secara ketat berdasarkan `sessionTenantId` hasil otorisasi server-side.
   - Parent Portal hanya menampilkan QRIS dan rekening bank milik tenant tempat siswa terdaftar.
2. **Aturan Pengubahan Konfigurasi**:
   - Pengubahan QRIS dan rekening bank hanya dapat dilakukan oleh role `owner` dan `admin` dari tenant tersebut.
   - Staff dari tenant lain atau pengguna portal ditolak secara absolut.
