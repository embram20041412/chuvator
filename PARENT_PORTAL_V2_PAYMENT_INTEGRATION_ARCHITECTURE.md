# CHUVATOR PARENT PORTAL V2 — PAYMENT INTEGRATION ARCHITECTURE
**Document Version:** 2.0  
**Status:** ARCHITECTURE FROZEN  
**Binding Decisions:** DECISION-04 (Integrated Payment), DECISION-06 (Read-Only Operational & Financial Access)  

---

## 1. INTEGRATED PAYMENT ARCHITECTURE OVERVIEW

In compliance with **DECISION-04**, Parent Portal V2 does NOT maintain its own payment ledger, wallet balance, or financial transaction database. All payment processing, fee validation, overpayment tracking, transaction journaling, and ledger reconciliations are executed exclusively by the **CHUA CORE Financial Engine**.

```
+-----------------------------------------------------------------------------------+
|                            TARGET PAYMENT FLOW SEQUENCE                           |
+-----------------------------------------------------------------------------------+

[ Parent Portal Client (Browser) ]
              |
              | 1. Authenticated Payment Request (studentId, tenantId, month)
              v
[ Cloudflare Pages Edge API (/api/portal/v2/initiate_payment) ]
              |
              | 2. Validate Session Cookie & CSRF Token
              | 3. Invoke Financial Core PL/pgSQL RPC via Database Access
              v
[ Financial Core Engine (Supabase PostgreSQL) ]
              |
              | 4. Validate Student Fee, Status, & Outstanding Amount (Server-side)
              | 5. Generate Dynamic Idempotency Key & Transaction Record
              v
[ Payment Gateway / QRIS Provider ] <--- Optional Direct Integration
              |
              | 6. Webhook Callback / Verification Push
              v
[ Financial Core Processing Routine ]
              |
              | 7. Validate Callback Signature & Amount
              | 8. Execute Double-Entry Jurnal in `global_ledger`
              | 9. Update `spp_payments.status` & `verification_status`
              v
[ Parent Portal API Refresh (/api/portal/billing) ]
              |
              | 10. Return Updated Verified Payment Status to Parent Dashboard
```

---

## 2. STRICT PAYMENT VALIDATION RULES

1. **Zero Client Trust on Nominal Amounts**:
   - The client browser NEVER supplies or alters the payment amount (`amount`).
   - The payment amount is queried directly from `students.spp_monthly_fee` or `spp_payments.amount` inside the database.
2. **Server-Side Idempotency Protection**:
   - Every payment request generates a unique SHA-256 payload hash stored in `pos_idempotency_keys`.
   - Parallel duplicate checkout attempts are rejected with `55P03 CONCURRENT_REQUEST`.
3. **No Direct Financial Table Mutations**:
   - Direct `INSERT`, `UPDATE`, or `DELETE` on `spp_payments`, `transactions`, or `global_ledger` from the browser is revoked.
   - All mutations must pass through `SECURITY DEFINER` routines (`pos_checkout_spp_atomic`, `admin_refund_spp_payment`).
4. **No Secondary Ledger in Portal**:
   - Parent Portal reads billing status dynamically via `parent_get_billing`. It never maintains a separate "portal wallet" or "portal balance" table.
5. **Gateway Webhook Authentication**:
   - Payment gateway callbacks (e.g. Midtrans/Xendit) must verify signature keys server-side before updating payment status in Financial Core.
