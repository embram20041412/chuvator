# CHUVATOR — PHASE 2.0 ARCHITECTURE SPECIFICATION

## 1. Overview
Document ini menjelaskan arsitektur teknis dari **CHUVATOR Phase 2.0 — Advanced Analytics & Reporting Module**. Modul ini dirancang dengan prinsip pemisahan penuh (*strict decoupling*) antara **Analytics Engine** (calculation layer) dan **UI Components** (presentation layer).

---

## 2. Decoupled Architecture Diagram

```text
+-------------------------------------------------------------------------------+
|                             SUPABASE DATABASE                                 |
|   (public.academy_evaluations, public.students, public.academy_classes)        |
+-------------------------------------------------------------------------------+
                                        |
                            Supabase Client SDK (JS)
                      .eq('tenant_id', tenantId) Filter
                                        v
+-------------------------------------------------------------------------------+
|                       SERVICE LAYER (Data Fetcher)                            |
|                 src/services/supabaseAcademyService.js                        |
+-------------------------------------------------------------------------------+
                                        |
                             Mapped Data Objects
                                        v
+-------------------------------------------------------------------------------+
|                   ANALYTICS ENGINE (Pure Calculations)                        |
|                     src/services/analyticsEngine.js                           |
|  - analyzeAthletePerformance()          - analyzePositionEventPerformance()   |
|  - analyzeAthleteDevelopment()          - compareAthletes()                   |
|  - analyzeAcademyTeamPerformance()      - generateAnalyticsReport()           |
|  - analyzeDataQuality()                                                       |
+-------------------------------------------------------------------------------+
                                        |
                          Deterministic Analytics Results
                                        v
+-------------------------------------------------------------------------------+
|                       PRESENTATION LAYER (UI Views)                           |
|                    src/components/AnalyticsSection.jsx                        |
|             (Mounted in Desktop & Mobile Hub Sub-Tabs)                         |
|  - Desktop: src/pages/AcademyPage.jsx                                         |
|  - Mobile: src/mobile/pages/academy/MobileAcademyHub.jsx                      |
+-------------------------------------------------------------------------------+
```

---

## 3. Core Principles & Data Flow

1. **Pure Functional Engine**:
   - `src/services/analyticsEngine.js` bersifat *deterministic*, *side-effect free*, dan dapat diuji secara terpisah tanpa DOM/React rendering.
   - Tidak melakukan *mutasi* pada objek evaluasi asli.

2. **Data Flow**:
   - **Step 1 (Authentication Context)**: Pengguna login via Supabase Auth; `useUserAccessScope` mendapatkan `tenantId` aktif.
   - **Step 2 (Service Query)**: `supabaseAcademyService.getEvaluationsByClass(tenantId, classId)` mengambil evaluasi publik yang terikat `tenant_id`.
   - **Step 3 (Engine Calculation)**: Objek evaluasi dan siswa diproses oleh `analyticsEngine.js` menggunakan Canonical Registries dari Phase 1.0.
   - **Step 4 (UI Rendering)**: Komponen `<AnalyticsSection />` merender Visualisasi Radar, Line Chart (Recharts), KPI Cards, dan opsi Cetak/Export.

---

## 4. Eight Analytics Modules Inventory

| Modul | Nama Modul | Fungsi Engine Utama | Deskripsi Singkat |
| :--- | :--- | :--- | :--- |
| **Module 1** | Athlete Performance Analytics | `analyzeAthletePerformance` | Skor Keseluruhan, Coverage %, Top 3 Keunggulan, dan Bottom 3 Area Pengembangan. |
| **Module 2** | Category & Indicator Analytics | `analyzeAthletePerformance` | Rincian rata-rata dan persentase kelengkapan per 6 pilar universal + pilar posisi. |
| **Module 3** | Position & Event Analytics | `analyzePositionEventPerformance` | Evaluasi khusus indikator posisi (Football 11, Futsal 5, Badminton 6 event). |
| **Module 4** | Athlete Development Progress | `analyzeAthleteDevelopment` | Tren perkembangan longitudinal, pengurutan kronologis, deteksi `coverageShift` & `contextMismatch`. |
| **Module 5** | Athlete Comparison | `compareAthletes` | Komparasi berdampingan atlet sepadan dengan penolakan lintas olahraga (`CROSS_SPORT_MISMATCH`). |
| **Module 6** | Academy & Team Analytics | `analyzeAcademyTeamPerformance` | Agregasi tim dengan pengisolasian `tenantId` mutlak. |
| **Module 7** | Advanced Reporting | `generateAnalyticsReport` | Payload generator untuk laporan atlet/tim dan browser print (`window.print()`). |
| **Module 8** | Data Quality & Coverage | `analyzeDataQuality` | Audit integritas data, deteksi nilai luar rentang ($<0$ atau $>100$), dan warning kelengkapan $<30\%$. |

---

## 5. UI Integration Contracts

- **Desktop View (`src/pages/AcademyPage.jsx`)**:
  - Ditempatkan sebagai sub-tab ke-4: `Presensi` \| `Evaluasi Atlet` \| `Growth Tracker` \| `Analitik & BI`.
- **Mobile View (`src/mobile/pages/academy/MobileAcademyHub.jsx`)**:
  - Ditempatkan pada sub-tab navigasi mobile `Analitik & BI` dengan dukungan *touch-friendly container* dan responsivitas penuh.
