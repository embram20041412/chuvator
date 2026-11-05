# PARENT PORTAL V2 — FASE 4A
## ANALISIS CELAH KESIAPAN INTEGRASI PEMBAYARAN (GAP ANALYSIS)
**Dokumen Spec & Gap:** `PARENT_PORTAL_V2_PHASE4A_GAP_ANALYSIS.md`  
**Status Mode:** READ-ONLY GAP ANALYSIS  
**Target Project:** CHUVATOR Parent Portal V2

---

### 1. ANALISIS MENDALAM GAP-06 (CELAH IDEMPOTENCY KEY PL/PGSQL)

Berdasarkan audit terhadap draft PL/pgSQL `02_phase2b3_rpc_routines.sql` pada fungsi `pos_checkout_spp_atomic`:

```sql
-- DRAFT SAAT INI (KODE BERMASALAH):
SELECT * INTO v_existing_idempotency
FROM public.pos_idempotency_keys
WHERE tenant_id = p_tenant_id 
  AND idempotency_key = p_idempotency_key 
  AND operation_type = 'POS_CHECKOUT'
FOR UPDATE;

IF FOUND THEN
    IF v_existing_idempotency.status = 'COMPLETED' THEN
        RETURN v_existing_idempotency.response_payload;
    ...
```

#### DETAIL DEFECT / KEMAJUAN GAP-06:
1. **Payload Hash Mismatch Ignored**: Jika pemanggil menggunakan `idempotency_key` yang sama namun mengirimkan payload/nominal yang BERBEDA (`v_payload_hash` berbeda), RPC saat ini tetap mengembalikan `response_payload` dari transaksi sebelumnya **TANPA MENOLAK / TANPA MEMBERIKAN ERROR CONFLICT**.
2. **Key Collision Across Operations**: Tabel `pos_idempotency_keys` membutuhkan kriteria unik namespace gabungan `(tenant_id, operation_type, idempotency_key)` agar key checkout POS tidak bertabrakan dengan key pembayaran daring atau refund.

#### REVISI SOLUSI GAP-06 (MANDATORI SEBELUM DEPLOYMENT):
```sql
IF FOUND THEN
    -- Verifikasi bahwa payload hash harus identik ketika key yang sama digunakan ulang
    IF v_existing_idempotency.payload_hash != v_payload_hash THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % already used with different payload', p_idempotency_key 
        USING ERRCODE = '23505';
    END IF;

    IF v_existing_idempotency.status = 'COMPLETED' THEN
        RETURN v_existing_idempotency.response_payload;
    ELSIF v_existing_idempotency.status = 'PROCESSING' THEN
        RAISE EXCEPTION 'CONCURRENT_REQUEST: Request with key % is currently processing', p_idempotency_key 
        USING ERRCODE = '55P03';
    END IF;
```

---

### 2. MATRIKS SELURUH GAP TEKNIS FASE 4

Berikut adalah daftar seluruh gap teknis yang wajib diselesaikan pada FASE 4B sebelum pembayaran daring dapat diaktifkan:

| ID Gap | Nama Gap / Komponen | Kategori Risk | Dampak Operasional | Solusi Teknis / Remediasi |
| :---: | :--- | :---: | :--- | :--- |
| **GAP-P4-01** | Missing Gateway SDK & Secrets | **HIGH** | Tidak ada API Key Midtrans/Xendit untuk inisiasi pembayaran. | PO menentukan provider & memasukkan Server Key ke rahasia Edge environment. |
| **GAP-P4-02** | Missing Inisiasi Endpoint | **HIGH** | Portal tidak dapat meminta Snap token / URL pembayaran. | Membuat handler Edge `/functions/api/portal/payment/initiate.js`. |
| **GAP-P4-03** | Missing Webhook Handler | **CRITICAL** | Status pembayaran di database tidak pernah terbarui menjadi Lunas. | Membuat handler Edge `/functions/api/portal/payment/webhook.js` dengan HMAC verification. |
| **GAP-P4-04** | Missing Online Payment RPCs | **CRITICAL** | `pos_checkout_spp_atomic` menolak akses role Parent. | Membuat RPC `parent_initiate_online_spp_payment` & `online_payment_webhook_settle_atomic`. |
| **GAP-P4-05** | Unresolved GAP-06 in Idempotency | **MEDIUM** | Potensi salah mengembalikan payload jika idempotency key dipakai ulang dengan nominal berbeda. | Memperbarui `02_phase2b3_rpc_routines.sql` dengan verifikasi `payload_hash`. |
