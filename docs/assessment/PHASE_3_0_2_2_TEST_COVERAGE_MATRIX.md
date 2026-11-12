# CHUVATOR — FOOTBALL SCOUTING COMBINE & ASSESSMENT BATTERY
## PHASE 3.0.2.2: PILOT TEST COVERAGE & INCLUSION/EXCLUSION MATRIX

**Document Version:** 3.0.2.2  
**Auditor Role:** Independent Sports Testing Operations Auditor  
**Status:** OFFICIAL TEST COVERAGE BASELINE  
**Total Canonical Objective Indicators in Registry:** 18  
**Pilot Combine Evaluated Indicators:** Exactly 8 Core Indicators (44.4%)  
**Pilot Combine Excluded Indicators:** Exactly 10 Indicators (55.6%)  

---

### 1. PRINCIPLE OF HONEST REPORTING & PARTIAL COVERAGE

A foundational principle of scientific integrity is that **a partial field testing battery must NEVER be reported as a complete 18-indicator assessment**.

The CHUVATOR Canonical Registry (`footballAssessmentData.js`) establishes 18 `OBJECTIVE_TEST` indicators. However, forcing all 18 tests into a single morning combine would cause severe athlete injury, logistical collapse, and metabolic contamination.

The 20-athlete Controlled Pilot evaluates a focused, high-priority **8-Indicator Core Combine Battery**, while the remaining 10 indicators are explicitly excluded for verifiable scientific, developmental, and equipment reasons.

---

### 2. COMPLETE INCLUSION & EXCLUSION CLASSIFICATION

```
====================================================================================================
CHUVATOR PILOT COMBINE: 18 OBJECTIVE INDICATOR COVERAGE AUDIT
====================================================================================================
Canonical ID     | Indicator Name        | Pilot Status | Primary Protocol / Operational Justification
-----------------|-----------------------|:------------:|-------------------------------------------
FTB-UNI-PHY-01   | Akselerasi            | **INCLUDED** | 10m Linear Split (Station 3, Photocell)
FTB-UNI-PHY-02   | Kelincahan            | **EXCLUDED** | Lacks soccer ecological validity (Light-pod)
FTB-UNI-PHY-03   | Keseimbangan          | **INCLUDED** | Y-Balance Lower Quarter (Station 1)
FTB-UNI-PHY-04   | Mobilitas             | **INCLUDED** | Weight-Bearing Lunge Test (Station 1)
FTB-UNI-PHY-06   | Kecepatan Maksimal    | **INCLUDED** | 30m Flying Split 20–30m (Station 3)
FTB-UNI-PHY-07   | Reaksi                | **EXCLUDED** | Non-specific visual tap; poor transfer
FTB-UNI-PHY-08   | Lompatan              | **INCLUDED** | Countermovement Jump CMJ (Station 2)
FTB-UNI-PHY-09   | Perubahan Arah        | **INCLUDED** | 505 COD Deficit Test (Station 4)
FTB-UNI-PHY-10   | Daya Tahan            | **INCLUDED** | Yo-Yo IR1 (Phase 5 Terminal Aerobic)
FTB-UNI-PHY-11   | Daya Ledak            | **INCLUDED** | Standing Broad Jump (Station 2)
FTB-UNI-PHY-12   | Kekuatan Tubuh        | **EXCLUDED** | UNTESTED; force plates unavailable (IMTP)
FTB-UNI-PHY-13   | Kekuatan Inti         | **EXCLUDED** | Prone Plank; reserved for indoor session
FTB-UNI-PHY-14   | Sprint Berulang (RSA) | **EXCLUDED** | 48h separation mandatory; Tier 4 only
FTB-UNI-TEC-07   | Kekuatan Tembakan     | **INCLUDED** | Doppler Radar Ball Kick Velocity (Station 4)
FTB-POS-WF-01    | Akselerasi Sayap      | **EXCLUDED** | Specialized Winger trial; not universal
FTB-SSB-OUT-02   | Koordinasi Mata-Kaki  | **EXCLUDED** | Tier 1 SSB specific (U8–U10 only)
FTB-SSB-GK-02   | Koordinasi Tangan-Mata| **EXCLUDED** | Tier 1 SSB specific (U8–U10 only)
FTB-SSB-GK-03   | Ketangkasan Gerak     | **EXCLUDED** | Tier 1 SSB specific (U8–U10 only)
====================================================================================================
TOTALS: INCLUDED IN COMBINE = 8 (44.4%) | EXCLUDED WITH RATIONALE = 10 (55.6%)
====================================================================================================
```

---

### 3. EXCLUSION RATIONALE FOR THE 10 EXCLUDED INDICATORS

#### 3.1 `FTB-UNI-PHY-12` (Kekuatan Tubuh / Body Strength) — AUDITOR DECISION
- **Auditor Mandate on Wall Squat / Push-Up:** Single-Leg Isometric Wall Squat Hold and Push-Up tests **MUST NOT** be treated as equivalent to Isometric Mid-Thigh Pull (IMTP).
  - IMTP measures *peak multi-joint vertical ground reaction force* ($F_{\max}$ in Newtons) and RFD.
  - Wall squat measures isolated quadriceps muscular endurance.
  - Push-ups measure upper-body anterior muscular endurance.
- **Formal Operational Decision:**
  1. `FTB-UNI-PHY-12` remains **COMPLETELY UNASSESSED (`null` / Untested)** in this pilot combine.
  2. Missing values will remain strict `null` and will **NEVER** be converted to zero or imputed.
  3. In a future authorized phase, the academy may either:
     - *Procure certified dual-axial force plates* ($1,000\text{ Hz}$) to execute IMTP legitimately.
     - *Or submit a formal registry change proposal* to redefine `FTB-UNI-PHY-12` as a validated field construct (e.g., Isometric Lower-Body Strength).
  4. **Strict Constraint:** No registry modification is permitted during Phase 3.0.2.2.

#### 3.2 `FTB-UNI-PHY-02` (Kelincahan / Reactive Agility) & `FTB-UNI-PHY-07` (Reaksi)
- **Scientific Grounds:** Commercial light-pod systems test non-specific reaction to LED flashes. They lack the perceptual-cognitive anticipatory cues of real match play (Sheppard & Young, 2006). Excluded from the core combine battery to prevent misleading coaches with unvalidated reaction scores.

#### 3.3 `FTB-UNI-PHY-14` (Sprint Berulang / Repeated Sprint Ability)
- **Physiological Safety Grounds:** Bangsbo RSA imposes extreme lactic acidosis ($\text{lactate} > 12\text{ mmol/L}$). Conducting RSA on the same day as Yo-Yo IR1 breaches international sports science guidelines and severely elevates hamstring strain risk. RSA is strictly reserved for a separate testing session with $\ge 48\text{ hours}$ separation for Tier 4 (U17+) athletes.

#### 3.4 `FTB-UNI-PHY-13` (Kekuatan Inti / Prone Plank Hold)
- **Logistical Grounds:** The 4-station morning combine focuses on high-velocity explosive, sprint, turning, and mobility metrics. Isometric plank holding to failure imposes deep abdominal fatigue that destabilizes the lumbo-pelvic cylinder during subsequent sprinting and jumping. Reserved for a separate indoor gym screening session.

#### 3.5 `FTB-POS-WF-01` (Akselerasi Sayap / Curved Sprint)
- **Tactical Specificity Grounds:** Evaluates flank-specific curved acceleration along a $17\text{m}$ radius arc. Excluded from the universal combine battery because $>70\%$ of the cohort consists of central positions (Center-Backs, Midfielders, Strikers) where curved touchline sprinting is not a primary positional demand.

#### 3.6 Tier 1 SSB Indicators (`FTB-SSB-OUT-02`, `FTB-SSB-GK-02`, `FTB-SSB-GK-03`)
- **Developmental Stratification Grounds:** These 3 indicators are explicitly designed for young children in Tier 1 Foundation (U8–U10). The pilot combine cohort comprises Tier 2 (U11–U13) and Tier 3 (U14–U16) athletes. Administering pediatric ball-toss tests to adolescent players is developmentally inappropriate.
