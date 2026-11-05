# PARENT PORTAL V2 — FASE 4B
## KONTRAK API ENDPOINT PEMBAYARAN MANUAL (API CONTRACT)
**Dokumen Contract:** `PARENT_PORTAL_V2_PHASE4B_API_CONTRACT.md`  
**Status Contract:** IMPLEMENTED & VERIFIED  
**Target Runtime:** Cloudflare Pages Functions Edge API

---

### 1. ENDPOINT 1: `POST /api/portal/upload_receipt`

Mengunggah file bukti transfer pembayaran (foto/pdf) ke sistem penyimpanan aman.

- **Request Headers**:
  - `Content-Type`: `application/json`
  - `X-Portal-CSRF`: `<csrf_token>`
  - `Cookie`: `portal_session_v2=<session_token>`
- **Request Body Payload**:
  ```json
  {
    "studentId": "uuid_siswa",
    "tenantId": "tnt_cabang_a",
    "sppPaymentId": "uuid_tagihan_spp",
    "fileBase64": "data:image/jpeg;base64,...",
    "fileName": "bukti_transfer_november.jpg",
    "fileType": "image/jpeg",
    "fileSize": 2048000
  }
  ```
- **Response Success (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "File bukti pembayaran berhasil diunggah.",
    "receiptUrl": "data:image/jpeg;base64,...",
    "fileMetadata": {
      "path": "tnt_cabang_a/uuid_siswa/uuid_tagihan_spp_1730768400000_token.jpg",
      "fileName": "uuid_tagihan_spp_token.jpg",
      "fileType": "image/jpeg",
      "fileSize": 2048000,
      "uploadedAt": "2026-11-05T02:00:00.000Z"
    }
  }
  ```
- **Response Error Scenarios**:
  - `401 Unauthorized`: Sesi portal tidak valid atau kedaluwarsa.
  - `403 Forbidden`: Sesi tidak terhubung dengan `studentId`/`tenantId` tersebut.
  - `400 Bad Request`: Ukuran file > 5 MB atau tipe file bukan JPG/PNG/WEBP/PDF.

---

### 2. ENDPOINT 2: `POST /api/portal/submit_proof`

Mengirim konfirmasi pembayaran manual dan menautkan URL bukti transfer ke tagihan SPP.

- **Request Body Payload**:
  ```json
  {
    "studentId": "uuid_siswa",
    "tenantId": "tnt_cabang_a",
    "sppPaymentId": "uuid_tagihan_spp",
    "receiptUrl": "data:image/jpeg;base64,...",
    "paymentMethod": "TRANSFER_BANK"
  }
  ```
- **Response Success (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Konfirmasi pembayaran berhasil dikirim. Status saat ini: MENUNGGU VERIFIKASI.",
    "confirmation": {
      "sppPaymentId": "uuid_tagihan_spp",
      "studentId": "uuid_siswa",
      "tenantId": "tnt_cabang_a",
      "status": "MENUNGGU VERIFIKASI",
      "verificationStatus": "unverified",
      "receiptUrl": "data:image/jpeg;base64,...",
      "submittedAt": "2026-11-05T02:00:00.000Z"
    }
  }
  ```

---

### 3. ENDPOINT 3: `POST /api/admin/verify_payment`

Endpoint verifikasi atau penolakan pembayaran manual khusus untuk **Owner Tenant** dan **Admin Tenant**.

- **Request Body Payload**:
  ```json
  {
    "tenantId": "tnt_cabang_a",
    "sppPaymentId": "uuid_tagihan_spp",
    "action": "VERIFY",
    "notes": "Disetujui oleh Owner Tenant",
    "staffRole": "owner",
    "staffUid": "usr_owner_001"
  }
  ```
- **Response Success (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Pembayaran berhasil disetujui (LUNAS).",
    "result": {
      "sppPaymentId": "uuid_tagihan_spp",
      "tenantId": "tnt_cabang_a",
      "action": "VERIFY",
      "verificationStatus": "verified",
      "status": "LUNAS",
      "notes": "Disetujui oleh Owner Tenant",
      "verifiedBy": "usr_owner_001",
      "verifiedRole": "owner",
      "timestamp": "2026-11-05T02:01:00.000Z"
    }
  }
  ```
- **Response Error (`403 Forbidden`)**:
  - Dikirimkan jika `staffRole` adalah `manager`, `kasir`, `staff`, `parent`, atau berasal dari tenant lain.
