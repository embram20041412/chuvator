# PARENT PORTAL V2 — FASE 4A
## DOKUMEN SPESIFIKASI KEAMANAN PEMBAYARAN (SECURITY DESIGN)
**Dokumen Spec & Security:** `PARENT_PORTAL_V2_PHASE4A_SECURITY_DESIGN.md`  
**Status Mode:** SECURITY ARCHITECTURE SPECIFICATION  
**Target Project:** CHUVATOR Parent Portal V2

---

### 1. PENANGANAN 16 VEKTOR ANCAMAN KEAMANAN PEMBAYARAN

Rancangan keamanan FASE 4 wajib mengantisipasi dan memitigasi 16 vektor ancaman secara *fail-closed*:

| ID | Vektor Ancaman Keamanan | Mekanisme Mitigasi & Proteksi Teknis |
| :---: | :--- | :--- |
| **SEC-P4-01** | Server-Side Authorization | Pengesahan token sesi terenkripsi AES-GCM 256-bit pada `_auth_v2.js` sebelum setiap inisiasi pembayaran. |
| **SEC-P4-02** | Parent-Child Relationship | Verifikasi bahwa `student_id` yang dibayar terhubung dengan `auth.uid()` parent di `parent_student_links`. |
| **SEC-P4-03** | Tenant Isolation | Pencocokan `tenant_id` secara ketat pada seluruh query database dan rincian transaksi order. |
| **SEC-P4-04** | Amount Tampering | Nominal tagihan dibaca langsung dari database server (`spp_payments`). Nominal dari request body browser diabaikan total. |
| **SEC-P4-05** | Reference Tampering | Pembuatan Order ID unik dengan entri terikat pada `tenant_id` dan `student_id` di database sebelum memanggil API Gateway. |
| **SEC-P4-06** | Duplicate Payment Request | Penggunaan Idempotency Key pada pendaftaran order (`v2_online_payment:<order_id>`) untuk mencegah inisiasi ganda. |
| **SEC-P4-07** | Webhook Replay Attack | Pengecekan idempotency pada handler webhook. Replay webhook dengan `order_id` yang sudah `COMPLETED` akan mengembalikan respons `200 OK` tanpa mengeksekusi ulang jurnal. |
| **SEC-P4-08** | Forged Webhook Attack | Verifikasi Signature HMAC (SHA-512) menggunakan Server Key Gateway yang tersimpan dalam variabel rahasia server Edge (`MIDTRANS_SERVER_KEY`). Webhook tanpa signature valid ditolak dengan HTTP `401 Unauthorized`. |
| **SEC-P4-09** | Out-of-Order Webhook | Pengecekan hierarki status transaksi. Status `SETTLED` tidak dapat ditimpa oleh callback `PENDING` yang datang kemudian. |
| **SEC-P4-10** | Callback Timeout | Penanganan timeout koneksi antara Gateway dan Edge API dengan batas waktu 10 detik. Jika timeout, transaksi tetap berstatus `PENDING` hingga webhook diterima. |
| **SEC-P4-11** | Retry Mechanism | Implementasi retry berbasis eksponensial backoff pada pendaftaran transaksi ke API Gateway. |
| **SEC-P4-12** | Expired Payment | Penetapan batas waktu kadaluwarsa pembayaran (misalnya 24 jam). Webhook status `EXPIRED` / `CANCELLED` otomatis mengubah status order menjadi `EXPIRED`. |
| **SEC-P4-13** | Callback Failure Recovery | Penyediaan Cron Job rekonsiliasi otomatis harian yang memanggil API Status Gateway untuk mencocokkan transaksi pending yang belum menerima webhook. |
| **SEC-P4-14** | Amount Mismatch | Verifikasi bahwa nominal yang dibayar pada webhook (`settled_amount`) tepat sama dengan nominal tagihan resmi. Jika kurang, status dicatat sebagai `PARSIAL`. |
| **SEC-P4-15** | Double Payment Prevention | Penguncian baris database (`FOR UPDATE`) pada transaksi SPP saat settlement dijalankan untuk mencegah dua webhook memproses pembayaran bersamaan. |
| **SEC-P4-16** | Overpayment Isolation | Kelebihan pembayaran yang masuk secara tidak sengaja dicatat dalam akun saldo terpisah `student_overpayment_balances` dan tidak secara otomatis memotong tagihan bulanan berikutnya. |

---

### 2. FORMULA VERIFIKASI SIGNATURE WEBHOOK (MIDTRANS SNAP)

Untuk memastikan webhook yang diterima benar-benar berasal dari Midtrans resmi, handler `/api/portal/payment/webhook` wajib memverifikasi signature dengan rumus SHA-512:

```
signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
```

Jika `calculated_signature !== payload.signature_key`, permintaan **HARUS DITOLAK SEGERA** tanpa memproses data apapun.
