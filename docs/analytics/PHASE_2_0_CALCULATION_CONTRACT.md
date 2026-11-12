# CHUVATOR — PHASE 2.0 CALCULATION CONTRACT & METRIC DEFINITIONS

## 1. Core Score Resolution Rules (Phase 1.0 Foundation Preservation)

Seluruh modul kalkulasi Analytics Engine wajib mematuhi aturan resolusi nilai berikut:

1. **`null` === UNTESTED**:
   - Indikator yang belum dinilai bernilai `null`.
   - **`null` DILARANG KERAS dikonversi menjadi `0`**.
   - Indikator `null` ditampilkan sebagai `'—'` di UI dan diabaikan dari pembagi rata-rata kategori/pilar.

2. **Skor `0` Adalah Nilai Valid**:
   - Nilai `0` atau `'0'` dievaluasi secara eksplisit sebagai skor numerik `0`.
   - Nilai `0` ikut serta dalam pembacaan rata-rata dan mempengaruhi perhitungan rata-rata.

3. **Prioritas Pembacaan Identitas Indikator**:
   - `indicator.id` (Canonical ID, misal: `FTB-UNI-PHY-01`) $\rightarrow$ `indicator.name` $\rightarrow$ `indicator.legacy_keys` $\rightarrow$ `null`.

---

## 2. Mathematical Formulas for Core Metrics

### A. Category Average ($C_{\text{avg}}$)
Category average hanya membagi jumlah indikator yang telah dinilai ($N_{\text{eval}}$):

$$C_{\text{avg}} = \text{Math.round}\left( \frac{\sum_{i \in \text{Evaluated}} S_i}{N_{\text{eval}}} \right)$$

Jika $N_{\text{eval}} = 0$, maka $C_{\text{avg}} = \text{null}$.

### B. Overall Performance Score ($S_{\text{overall}}$)
Overall score dihitung sebagai rata-rata dari kategori yang memiliki rata-rata valid ($K_{\text{valid}}$):

$$S_{\text{overall}} = \text{Math.round}\left( \frac{\sum_{k \in K_{\text{valid}}} C_k}{|K_{\text{valid}}|} \right)$$

Jika $|K_{\text{valid}}| = 0$, maka $S_{\text{overall}} = \text{null}$.

### C. Evaluation Coverage Rate ($E_{\text{cov}}$)
Persentase indikator yang telah dinilai dibandingkan total indikator yang tersedia pada registri kurikulum cabang olahraga/tier:

$$E_{\text{cov}} = \text{Math.round}\left( \frac{N_{\text{eval}}}{N_{\text{total\_registry}}} \times 100 \right)$$

---

## 3. Metric Separation Principle

Empat metrik berikut adalah **metrik yang berbeda dan terpisah secara sistematis**:
1. **Performance Score ($S_{\text{overall}}$)**: Mengukur kualitas/skor teknis indikator yang dinilai.
2. **Evaluation Coverage ($E_{\text{cov}}$)**: Mengukur persentase indikator yang sudah diisi.
3. **Data Completeness**: Rasio pilar ter-evaluasi dibanding 6 pilar universal.
4. **Development Trend**: Delta skor pergerakan longitudinal antar sesi evaluasi.

*Dilarang menggabungkan keempat metrik ini menjadi satu skor "Black-Box" tunggal tanpa dasar formula ilmiah yang disetujui.*

---

## 4. Multi-Sport & Registry Scope

- **Football (219 Total)**:
  - Universal (84): 18 Fiz, 21 Tek, 17 Tak, 10 Men, 8 Kom, 10 Dev.
  - Position Specific (125): 11 Klaster Posisi.
  - SSB Tier 1 (10): OUTFIELD_SSB (5), GK_SSB (5).
- **Futsal (145 Total)**:
  - Universal (77): 18 Fiz, 18 Tek, 13 Tak, 10 Men, 10 Dev, 8 Kom.
  - Position Specific (58): GK (12), FIXO (12), ALA (12), PIVOT (12), UNIVERSAL (10).
  - SSB Tier 1 (10): COURT_DASAR (5), GK_DASAR (5).
- **Badminton (121 Total)**:
  - Universal (73): 15 Fiz, 16 Tek, 18 Tak, 8 Men, 8 Kom, 8 Dev.
  - Event Specific (48): BASIC_SINGLE (5), MS (8), WS (8), MD (9), WD (9), XD (9).
