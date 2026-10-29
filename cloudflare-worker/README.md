# Cloudflare Worker Backend — Firebase Auth RBAC Multi-Tenant
## CHUA SPORT CORE — Sports Arena & Academy ERP

Backend serverless berbasis Cloudflare Workers untuk mengelola pembuatan akun staff/karyawan (Kasir POS & Pelatih Akademi) dan menyematkan Firebase Auth **Custom Claims** (`tenantId` dan `role`) secara otomatis.

---

## 1. Arsitektur & Keamanan Backend

- **Provider Autentikasi**: Menggunakan Google Identity Toolkit Admin API via OAuth2 Service Account Token.
- **Isolasi Tenant**: Memverifikasi Firebase ID Token milik Owner sebelum memproses pendaftaran staf. Staf yang terdaftar hanya mendapatkan hak akses `kasir` atau `pelatih` untuk `tenantId` Owner yang mendaftarkan.
- **Resilient CORS**: Mendukung preflight HTTP `OPTIONS` dengan header `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, dan `Access-Control-Allow-Headers`.

---

## 2. Langkah Setup & Deployment

### Langkah A: Unduh Kunci Service Account Firebase
1. Buka [Firebase Console](https://console.firebase.google.com).
2. Pilih project `chua-sport-core`.
3. Buka **Project Settings** (Ikon Gerigi) -> Tab **Service accounts**.
4. Klik **Generate new private key** (Buat kunci privat baru) dan unduh file JSON-nya.

### Langkah B: Simpan Secret Kunci Layanan ke Cloudflare Workers
Buka terminal di direktori `cloudflare-worker`:
```bash
cd cloudflare-worker
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY
```
Saat terminal meminta input, salin seluruh isi file JSON Service Account dan tekan **Enter**.

### Langkah C: Deploy Worker Backend
Jalankan perintah deployment menggunakan Wrangler CLI:
```bash
npx wrangler deploy
```
Wrangler akan men-deploy worker dengan nama `chua-sport-core` dan menampilkan URL aktif:
`https://chua-sport-core.<subdomain>.workers.dev` (misalnya: `https://chua-sport-core.embram1989.workers.dev`)

---

## 3. Sinkronisasi URL Worker ke Frontend

Di aplikasi frontend React (`.env` atau file konfigurasi `src/config/apiConfig.js`):
```env
VITE_WORKER_URL="https://chua-sport-core.embram1989.workers.dev"
```

Konstanta tunggal pada `src/config/apiConfig.js`:
```javascript
export const PRODUCTION_WORKER_URL = 'https://chua-sport-core.embram1989.workers.dev';
```

---

## 4. Spesifikasi API Endpoint

### A. `GET /api/health`
Status diagnostik kesehatan worker dan verifikasi konfigurasi Service Account.

**Response (200 OK):**
```json
{
  "success": true,
  "status": "online",
  "service": "Chua Sport Core Staff RBAC Backend Worker",
  "environment": {
    "projectId": "chua-sport-core",
    "serviceAccountConfigured": true,
    "version": "2.0.0-enterprise"
  },
  "endpoints": [
    "GET /api/health",
    "POST /api/create-staff",
    "POST /api/login-staff",
    "POST /api/set-custom-claims"
  ],
  "timestamp": "2026-10-21T04:30:00.000Z"
}
```

---

### B. `POST /api/create-staff`
Membuat akun staff baru di Firebase Auth dan menyematkan Custom Claims: `{ tenantId, role }`.

**Headers:**
- `Authorization: Bearer <ID_TOKEN_OWNER>` (Diperoleh dari `auth.currentUser.getIdToken()`)
- `Content-Type: application/json`

**Payload Body:**
```json
{
  "email": "kasir1@arenasport.com",
  "password": "Password123!",
  "displayName": "Rian Ardianto",
  "role": "kasir",
  "tenantId": "tenant_abc123"
}
```

**Response Sukses (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Akun staff berhasil dibuat dan Custom Claims RBAC telah disematkan.",
  "data": {
    "uid": "firebase_auth_uid_xyz",
    "email": "kasir1@arenasport.com",
    "displayName": "Rian Ardianto",
    "role": "kasir",
    "tenantId": "tenant_abc123",
    "customClaims": {
      "role": "kasir",
      "tenantId": "tenant_abc123",
      "registeredBy": "owner@arenasport.com"
    }
  }
}
```

**Response Email Duplikat (409 Conflict):**
```json
{
  "success": false,
  "statusCode": 409,
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "Email \"kasir1@arenasport.com\" sudah terdaftar di sistem Firebase Authentication. Harap gunakan alamat email lain."
}
```

---

### C. `POST /api/login-staff`
Autentikasi akun staf via backend dan penerbitan Firebase Custom Token (RS256).

**Payload Body:**
```json
{
  "email": "kasir1@arenasport.com",
  "password": "Password123!"
}
```

**Response Sukses (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Autentikasi staf via Cloudflare Worker berhasil.",
  "customToken": "eyJhbGciOiJSUzI1NiIs...",
  "data": {
    "uid": "firebase_auth_uid_xyz",
    "email": "kasir1@arenasport.com",
    "role": "kasir",
    "tenantId": "tenant_abc123"
  }
}
```

---

## 5. Panduan Troubleshooting Error Umum

| Pesan Error | Penyebab Utama | Solusi Perbaikan |
|---|---|---|
| `Failed to fetch` / `TypeError: Failed to fetch` | Worker belum di-deploy ke URL yang dipanggil, URL salah, atau browser memblokir request preflight CORS. | 1. Buka folder `cloudflare-worker` dan jalankan `npx wrangler deploy`. <br/> 2. Pastikan `VITE_WORKER_URL` di frontend mengarah ke URL HTTPS Worker yang benar. <br/> 3. Gunakan tombol "Uji Status" di halaman Staff Management. |
| `HTTP 405 Method Not Allowed` / Respons HTML | URL Worker mengarah ke hosting frontend SPA statis, bukan script Worker backend API. | Ubah URL Worker di `apiConfig.js` atau modal Pengaturan Worker ke endpoint Worker API aktif (`https://chua-sport-core.embram1989.workers.dev`). |
| `CONFIGURATION_ERROR: FIREBASE_SERVICE_ACCOUNT_KEY belum dikonfigurasi` | Secret kunci layanan Firebase belum disimpan di Cloudflare Worker Secrets. | Jalankan `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY` lalu masukkan JSON Service Account dari Firebase Console. |
| `FORBIDDEN: Hanya Owner dari tenant yang bersangkutan...` | Akun pemanggil bukan Owner dari `tenantId` yang didaftarkan. | Pastikan Anda login dengan akun Owner arena yang mendaftarkan tenant tersebut. |
| `Missing or insufficient permissions` (Firestore) | Rules Firestore memblokir pembacaan/penulisan ke `users_staff` atau `tenants`. | Pastikan `firestore.rules` mengizinkan `allow read, write: if request.auth != null;` untuk koleksi `users_staff`. |
