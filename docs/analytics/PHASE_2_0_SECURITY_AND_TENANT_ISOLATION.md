# CHUVATOR — PHASE 2.0 SECURITY & TENANT ISOLATION SPECIFICATION

## 1. Multi-Layer Tenant Security Model

Pengisolasian data antar-tenant (*multi-tenant isolation*) pada CHUVATOR Phase 2.0 menggunakan 3 lapisan keamanan:

```text
[Layer 1: Application Auth Context] -> [Layer 2: Service Query Filter] -> [Layer 3: Supabase RLS Engine]
```

---

## 2. Layer Description & Status

### Layer 1: Application Auth Context
- **Lokasi**: `src/hooks/useUserAccessScope.js`, `src/pages/AcademyPage.jsx`, `src/mobile/pages/academy/MobileAcademyHub.jsx`.
- **Mekanisme**: `tenantId` diekstrak dari JWT token / profil akun terautentikasi dan diteruskan ke modul Analytics.
- **Status**: **VERIFIED**

### Layer 2: Service Query & Engine Filtering
- **Lokasi**: `src/services/supabaseAcademyService.js` & `src/services/analyticsEngine.js`.
- **Mekanisme**: Setiap query Supabase SDK diikat dengan `.eq('tenant_id', tenantId)`. Di dalam `analyticsEngine.js`, fungsi `analyzeAcademyTeamPerformance` memfilter ulang array siswa dan evaluasi berdasarkan `tenantId`.
- **Status**: **VERIFIED**

### Layer 3: Database Row-Level Security (RLS)
- **Lokasi**: Supabase PostgreSQL Engine (`public.academy_evaluations`, `public.students`, `public.academy_classes`).
- **Mekanisme**: Kebijakan RLS membatasi baris data yang dapat dibaca sesuai `auth.uid()` dan `tenant_id`.
- **Status Verification Note**: **VERIFIED VIA CLIENT SDK BEHAVIOR**. *(Direct SQL Policy Audit: UNVERIFIED — tidak ada eksekusi SQL/DDL langsung per aturan keamanan produksi).*

---

## 3. Negative Tenant Isolation Test Case

Diuji secara otomatis pada `src/services/analyticsEngine.test.js` (Test #3):

```js
test('3. Tenant Isolation Negative Test (Tenant A vs Tenant B)', () => {
  const students = [
    { id: 's1', name: 'Student Tenant A', tenantId: 'tenant-a' },
    { id: 's2', name: 'Student Tenant B', tenantId: 'tenant-b' }
  ];

  const evaluations = [
    { id: 'e1', studentId: 's1', tenantId: 'tenant-a', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 95 } },
    { id: 'e2', studentId: 's2', tenantId: 'tenant-b', activeTier: 1, scores: { 'FTB-UNI-PHY-01': 40 } }
  ];

  const teamA = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-a' });
  const teamB = analyzeAcademyTeamPerformance({ evaluations, students, sport: 'football', tenantId: 'tenant-b' });

  assert.equal(teamA.totalStudents, 1);
  assert.equal(teamA.teamCategoryAverages.fisik, 95);

  assert.equal(teamB.totalStudents, 1);
  assert.equal(teamB.teamCategoryAverages.fisik, 40);

  // Negative assertion: Data Tenant B dilarang bocor ke Tenant A
  assert.equal(teamA.evaluatedStudentsCount, 1);
  assert.notEqual(teamA.teamCategoryAverages.fisik, 40);
});
```
