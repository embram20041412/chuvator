# CHUVATOR — FOOTBALL SCOUTING COMBINE & ASSESSMENT BATTERY
## PHASE 3.0.2: MASTER STANDARD OPERATING PROCEDURE (SOP)

**Document Version:** 3.0.2  
**Status:** APPROVED FOR STANDARDIZATION — PRE-SCORING ENGINE BASELINE  
**Classification:** Operational Standard & Sports Science Protocol  
**Domain:** Football (Soccer) Performance Assessment & Academy Scouting Combine  

---

### 1. OBJECTIVE & ARCHITECTURAL BOUNDARIES

#### 1.1 Purpose
This Master Standard Operating Procedure (SOP) establishes the standardized operational, environmental, physiological, and safety rules for conducting the **CHUVATOR Football Scouting Combine & Objective Assessment Battery**.

The primary scientific objective is to **eliminate subjective scoring estimation** by coaches and evaluators by measuring athletes through rigorous, standardized, empirical testing protocols, while retaining a robust observational rubric framework for complex tactical and technical behaviors.

#### 1.2 Strict Single Source of Truth
1. **Canonical Registry Immutability:** The existing Athlete Development Assessment (`src/config/footballAssessmentData.js`) remains the sole, inviolable source of truth for:
   - Canonical Indicator IDs (e.g., `FTB-UNI-PHY-01`, `FTB-POS-WF-01`, `FTB-SSB-OUT-02`).
   - Indicator names, category assignments, and legacy alias mappings.
   - Curriculum tier definitions and position clusters.
2. **Pre-Scoring Engine Status:** This phase establishes **measurement protocols, equipment standards, and observation rubrics only**. It **DOES NOT** implement mathematical conversion formulas, percentile ranking algorithms, or raw-to-score (1–100) lookup tables. Raw empirical data collection must achieve repeatability, construct validity, and inter-rater reliability prior to scoring formula implementation.
3. **Multi-Tenant Isolation:** Assessment event data and athlete records belong strictly to the authenticated academy tenant context. No cross-tenant data leakage or pooled normative calculations shall occur without explicit tenant scoping.

---

### 2. RECONCILED BASELINE SPECIFICATION

Based on the verified audit of `src/config/footballAssessmentData.js` and `phase1Acceptance.test.js`, the CHUVATOR Football Assessment Registry comprises exactly **219 canonical indicators**:

```
========================================================================================
CHUVATOR FOOTBALL CANONICAL REGISTRY STRUCTURE (219 INDICATORS)
========================================================================================
1. UNIVERSAL INDICATORS (84 Total across 6 Core Categories)
   ├── Physical / Fisik (16)       : 13 OBJECTIVE_TEST | 2 OBSERVATION_RUBRIC | 1 READINESS_CONTEXT
   ├── Technical / Teknik (20)     :  1 OBJECTIVE_TEST | 19 OBSERVATION_RUBRIC
   ├── Tactical / Taktik (20)      :  0 OBJECTIVE_TEST | 20 OBSERVATION_RUBRIC
   ├── Mental (10)                 :  0 OBJECTIVE_TEST |  9 OBSERVATION_RUBRIC | 1 DEVELOPMENT_TRACKING
   ├── Communication (8)           :  0 OBJECTIVE_TEST |  8 OBSERVATION_RUBRIC
   └── Development (10)            :  0 OBJECTIVE_TEST |  2 OBSERVATION_RUBRIC | 5 DEVELOPMENT_TRACKING
                                     1 READINESS_CONTEXT | 2 ADMINISTRATIVE_DATA
   Subtotal Universal              : 14 OBJECTIVE_TEST | 60 OBSERVATION_RUBRIC | 6 DEV | 2 READINESS | 2 ADMIN = 84

2. TIER 1 SSB CLUSTERS (10 Total across 2 Clusters)
   ├── Outfield (OUTFIELD_SSB) (5) :  1 OBJECTIVE_TEST | 2 OBSERVATION_RUBRIC | 2 READINESS_CONTEXT
   └── Goalkeeper (GK_SSB) (5)     :  2 OBJECTIVE_TEST | 2 OBSERVATION_RUBRIC | 1 READINESS_CONTEXT
   Subtotal Tier 1 SSB             :  3 OBJECTIVE_TEST | 4 OBSERVATION_RUBRIC | 3 READINESS_CONTEXT = 10

3. POSITION-SPECIFIC CLUSTERS (125 Total across 11 Tactical Roles)
   ├── GK (15), CB (12), LB/RB (10), WB (10), DM (12), CM (12), AM (12), LM/RM (10), SS (10), ST (12)
   │   └── All 115 indicators are OBSERVATION_RUBRIC
   └── WFR/WFL (10)                :  1 OBJECTIVE_TEST (FTB-POS-WF-01) | 9 OBSERVATION_RUBRIC
   Subtotal Position-Specific      :  1 OBJECTIVE_TEST | 124 OBSERVATION_RUBRIC = 125

========================================================================================
GRAND TOTAL : 18 OBJECTIVE_MEASURABLE | 188 OBSERVATION_RUBRIC | 6 DEV_TRACKING
              5 READINESS_CONTEXT     |   2 ADMINISTRATIVE_DATA  = 219 CANONICAL INDICATORS
========================================================================================
```

---

### 3. ATHLETE AGE, MATURITY, AND TIER GOVERNANCE

A fundamental flaw in youth sports scouting is the conflation of chronological age, biological maturity, and curriculum tier. CHUVATOR strictly decouples these three orthogonal dimensions:

```
+---------------------------------------------------------------------------------------+
|                             ATHLETE PROFILE DIMENSIONS                                |
+---------------------------+---------------------------+-------------------------------+
|     CHRONOLOGICAL AGE     |    BIOLOGICAL MATURITY    |        CURRICULUM TIER        |
+---------------------------+---------------------------+-------------------------------+
| Calculated from validated | Somatic maturity offset   | Academy pedagogical placement |
| birthDate (ISO format).   | (Years from Peak Height   | based on tactical/technical   |
| Missing DOB produces      | Velocity — PHV via the    | competence:                   |
| 'AGE_UNVERIFIED'.         | Mirwald equation).        | T1: Foundation (SSB)          |
| Never assume or impute!   | Identifies Early, On-Time,| T2: Development               |
|                           | or Late Maturers.         | T3: Advanced Development      |
|                           |                           | T4: Performance (Elite)       |
+---------------------------+---------------------------+-------------------------------+
```

#### 3.1 Date of Birth & Age Integrity Rules
1. **Rule of Age Immutability:** Date of birth must be verified via official identity documents (Akta Kelahiran / Kartu Identitas Anak / Paspor).
2. **Missing Birthdate Handling:** If `birthDate` is null, empty string, or whitespace, the system assigns status `AGE_UNVERIFIED`. The system **MUST NEVER** default an athlete's age to 10 years or any arbitrary baseline.
3. **Assessment Date Snapshot:** Chronological age must be computed as of the exact date of testing:
   $$\text{Age}_{\text{decimal}} = \frac{\text{Test Date} - \text{Birth Date}}{365.25}$$

#### 3.2 Biological Maturity Assessment (Mirwald Maturity Offset)
Youth football players of identical chronological age (e.g., 14.0 years) can vary by up to 4–5 years in skeletal and biological maturity. Early maturers possess temporary advantages in height, muscle mass, sprint speed, and power, which often leads to selection bias.

To correct for this, the combine battery records:
1. **Standing Height ($H$, cm):** Measured with a wall-mounted stadiometer to nearest 0.1 cm.
2. **Sitting Height ($SH$, cm):** Measured on a standardized 50 cm testing box to nearest 0.1 cm.
3. **Leg Length ($LL$, cm):** Calculated as $LL = H - SH$.
4. **Body Mass ($M$, kg):** Measured with a calibrated digital medical scale to nearest 0.1 kg.

**Mirwald Maturity Offset Equation (Boys):**
$$\text{Maturity Offset (years)} = -9.236 + (0.0002708 \times (LL \times SH)) - (0.001663 \times (\text{Age} \times LL)) + (0.007216 \times (\text{Age} \times SH)) + (0.02292 \times (M / H \times 100))$$

- **Maturity Offset < -1.0 year:** Pre-PHV (Circa-pubertal / Foundation).
- **-1.0 year $\le$ Maturity Offset $\le$ +1.0 year:** Circa-PHV (Peak Growth Spurt — High Vulnerability to overuse injuries).
- **Maturity Offset > +1.0 year:** Post-PHV (Adult-like training tolerance).

---

### 4. ENVIRONMENTAL & FACILITY TESTING STANDARDS

#### 4.1 Ambient Conditions & Heat Policy
1. **Wet-Bulb Globe Temperature (WBGT):** Combine testing must not proceed if WBGT exceeds 32.2°C (89.9°F) per FIFA Medical heat guidelines.
2. **Indoor vs Outdoor Testing:**
   - Anthropometry, Mobility, Jump/Power, and Reaction tests must be conducted indoors or in a covered pavilion protected from direct sunlight and wind.
   - Sprints, COD, and Ball Velocity tests may be conducted on an outdoor pitch or indoor sports hall.
3. **Surface Specification:**
   - Testing pitch must be either FIFA Quality Pro certified artificial turf (dry) or natural grass in pristine condition without depressions, standing water, or divots.
   - Surface traction must be verified using a standardized stud traction tester prior to sprint and agility batteries.
   - Running footwear must be standardized: firm ground (FG) studs or artificial grass (AG) multi-stud boots on turf; flat non-marking rubber sole shoes on indoor tartan/hardwood. Metal screw-in studs are strictly prohibited during testing.

#### 4.2 Calibration and Quality Control
All electronic equipment must undergo mandatory pre-session calibration:
1. **Dual-Beam Photocell Timing Gates:** Align transmitter and reflector units using laser alignment sights. Gate height set to **0.80 m (hip height) for U11–U13** and **0.90 m for U14+** to prevent false triggering from swinging arms. Test with a pass-through baton at 0.5 m/s.
2. **Contact Mats / Force Plates:** Zero-load balance calibration prior to each testing cohort. Ensure battery voltage $\ge 85\%$.
3. **Doppler Radar Guns:** Internal frequency tuning fork test (e.g., 40.0 km/h tuning fork) at session commencement.
4. **Weighing Scales & Stadiometers:** Spirit level leveled surface. Calibration verification with certified 10.0 kg reference test weight.

---

### 5. STANDARDIZED TESTING BATTERY & DAILY SEQUENCING

#### 5.1 The Principle of Fatigue Hierarchies
Testing order is governed by neuromuscular and bioenergetic fatigue principles (NSCA, 2021). Tests requiring high central nervous system (CNS) freshness, fine motor coordination, and short-duration alactic power must always precede fatiguing anaerobic or aerobic conditioning tests.

```
========================================================================================
STANDARD COMBINE TESTING ORDER (WITHIN A SINGLE-DAY TESTING WINDOW)
========================================================================================
Order | Station / Component                       | Energy System / Modality   | CNS Demand
------|-------------------------------------------|----------------------------|-----------
1     | Anthropometry, Maturity (PHV), Screening  | Resting / Structural       | Zero
2     | Mobility (WBLT) & Balance (Y-Balance)     | Neuromuscular / Proprio    | Low
3     | Vertical Jump (CMJ) & Broad Jump (Power)  | Alactic Explosive (ATP-PC) | Very High
4     | Linear Sprint (10m & 30m Dual Split)      | Maximum Acceleration/Speed | Very High
5     | Change of Direction (505 COD Test)        | Deceleration & Re-Accel    | High
6     | Technical Ball Exit Velocity (Radar Gun)  | Kicking Biomechanics       | Moderate
------|-------------------------------------------|----------------------------|-----------
BREAK | 45-60 MINUTE RECOVERY & REHYDRATION WINDOW (LIGHT CARBOHYDRATE SNACK)
------|-------------------------------------------|----------------------------|-----------
7     | Submaximal or Intermittent Aerobic Test   | Aerobic Intermittent       | High
      | (Yo-Yo IR1 — ONLY if not running RSA!)    | (Oxidative Glycolysis)     | (Peripheral)
========================================================================================
```

#### 5.2 The Non-Negotiable 48-Hour Metabolic Separation Rule
$$\mathbf{YYIR1\ (FTB-UNI-PHY-10)\ \cap\ RSA\ (FTB-UNI-PHY-14)\ =\ \emptyset\quad (Same\ Day)}$$

- **The Conflict:** Yo-Yo Intermittent Recovery Level 1 measures intermittent aerobic capacity, glycogen replenishment, and high-intensity running tolerance. Repeated Sprint Ability ($6 \times 30\text{m}$ with 20s recovery) measures anaerobic glycolytic power, phosphocreatine resynthesis, and fatigue resistance under severe metabolic acidosis (lactate $> 12\text{ mmol/L}$, $\text{pH} < 7.2$).
- **The Mandate:** These two tests **MUST NEVER** be conducted on the same day. Conducting RSA after YYIR1 produces catastrophic neuromuscular fatigue, confounding sprint decrement measurements ($S_{dec}\%$) and drastically increasing hamstring strain risk.
- **Protocol:** In a 2-day combine:
  - **Day 1 Afternoon:** Yo-Yo Intermittent Recovery Level 1.
  - **Day 2 (or Day 3, 48h later):** Repeated Sprint Ability (RSA) test.

---

### 6. STANDARDIZED RAMP WARM-UP PROTOCOL

Before performing any maximal explosive, sprint, or agility test, all athletes must complete the standardized **RAMP (Raise, Activate, Mobilize, Potentiate)** protocol (Jeffreys, 2007) lasting exactly **18–20 minutes**:

```
+---------------------------------------------------------------------------------------+
|                       RAMP WARM-UP PHASES (18–20 MINUTES TOTAL)                       |
+---------------+-------------------------------------------------------+---------------+
| Phase         | Activities                                            | Duration      |
+---------------+-------------------------------------------------------+---------------+
| 1. RAISE      | Low-intensity jogging, backwards running, side-to-side| 5 minutes     |
|               | shuffling, carioca, multi-directional light movement. |               |
|               | Target: Elevate core body temperature & HR to ~130 bpm|               |
+---------------+-------------------------------------------------------+---------------+
| 2. ACTIVATE   | Glute bridges, monster walks with mini-bands, single- | 4 minutes     |
|               | leg balance reach, core dead-bugs, calf raises.       |               |
|               | Target: Neural activation of gluteus medius/maximus.  |               |
+---------------+-------------------------------------------------------+---------------+
| 3. MOBILIZE   | Dynamic hip openers (gate in/out), walking lunges with| 5 minutes     |
|               | thoracic rotation, inchworms, leg swings (sagittal/   |               |
|               | frontal). No static stretching >5 seconds!            |               |
+---------------+-------------------------------------------------------+---------------+
| 4. POTENTIATE | Submaximal sprint build-ups:                          | 5 minutes     |
|               | - 1 x 20m at 70% perceived effort                     |               |
|               | - 1 x 20m at 85% perceived effort                     |               |
|               | - 1 x 10m sprint at 95% effort with flying deceleration|               |
|               | - 2 progressive submaximal vertical jumps.            |               |
|               | Followed by 2 minutes of passive recovery before test.|               |
+---------------+-------------------------------------------------------+---------------+
```

---

### 7. TIER-SPECIFIC TESTING MATRIX

Not all tests are safe, meaningful, or developmentally appropriate for all curriculum tiers. CHUVATOR enforces the following developmental testing eligibility matrix:

| Canonical ID | Indicator Name | T1: Foundation (U8–U10) | T2: Development (U11–U13) | T3: Adv Dev (U14–U16) | T4: Performance (U17+) | Testing Status |
|---|---|:---:|:---:|:---:|:---:|---|
| `FTB-UNI-PHY-01` | Akselerasi (10m) | OPTIONAL (Submax) | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Electronic Gates) |
| `FTB-UNI-PHY-02` | Kelincahan (Reactive) | NO (Pre-planned only) | OPTIONAL | **MANDATORY** | **MANDATORY** | REQUIRES SCIENTIFIC VALIDATION |
| `FTB-UNI-PHY-03` | Keseimbangan (YBT) | **MANDATORY** (FMS) | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Y-Balance Lower) |
| `FTB-UNI-PHY-04` | Mobilitas (WBLT) | **MANDATORY** | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Inclinometer WBLT) |
| `FTB-UNI-PHY-06` | Kecepatan Maks (30m) | NO (Inappropriate) | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (20-30m Flying Split) |
| `FTB-UNI-PHY-07` | Reaksi (Visual RT) | OPTIONAL | **MANDATORY** | **MANDATORY** | **MANDATORY** | REQUIRES SCIENTIFIC VALIDATION |
| `FTB-UNI-PHY-08` | Lompatan (CMJ) | NO (Sargent jump only)| **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Contact Mat/Optojump) |
| `FTB-UNI-PHY-09` | Perubahan Arah (505) | NO | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (505 COD Deficit) |
| `FTB-UNI-PHY-10` | Daya Tahan (YYIR1) | NO (Max aerobic banned)| OPTIONAL (Submax) | **MANDATORY** | **MANDATORY** | PASS (Yo-Yo IR1 Audio CD) |
| `FTB-UNI-PHY-11` | Daya Ledak (Broad) | **MANDATORY** (Broad) | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Standing Broad Jump) |
| `FTB-UNI-PHY-12` | Kekuatan Tubuh | Bodyweight push-up | Bodyweight push-up | IMTP / Push-up | IMTP / Pull-up | REQUIRES SCIENTIFIC VALIDATION |
| `FTB-UNI-PHY-13` | Kekuatan Inti | Prone Plank (Submax) | Isometric Plank (s) | Isometric Plank (s) | 4-Way Plank Battery | PASS (Standardized Plank) |
| `FTB-UNI-PHY-14` | Sprint Berulang | **STRICTLY PROHIBITED**| **STRICTLY PROHIBITED**| OPTIONAL (T3 late) | **MANDATORY** | PASS (Bangsbo 6x30m RSA) |
| `FTB-UNI-TEC-07` | Kekuatan Tembakan | NO (Apophyseal risk) | **MANDATORY** | **MANDATORY** | **MANDATORY** | PASS (Doppler Radar Gun) |
| `FTB-POS-WF-01` | Akselerasi Sayap | NO | NO | **Winger Specific** | **Winger Specific** | PASS (Curved 30m Sprint) |
| `FTB-SSB-OUT-02` | Koordinasi Mata-Kaki| **MANDATORY** (T1) | NO (Universalized) | NO | NO | PASS (Rebound Wall Pass) |
| `FTB-SSB-GK-02` | Koordinasi Tangan-Mata| **MANDATORY** (T1) | NO | NO | NO | PASS (Wall Toss & Catch) |
| `FTB-SSB-GK-03` | Ketangkasan Gerak | **MANDATORY** (T1) | NO | NO | NO | PASS (Hexagon Agility) |

---

### 8. DATA GOVERNANCE & AUDIT CONTROLS

#### 8.1 Dual-Entry Recording Protocol
To eliminate transcription errors during high-tempo field testing:
1. **Electronic Synchronization:** Electronic timing gate units and jump mats with Bluetooth export directly into the local staging applet.
2. **Hardcopy Backup:** A designated field scribe records raw values simultaneously on physical, waterproof scoring cards.
3. **Reconciliation Check:** At the conclusion of each testing station, the station evaluator and scribe cross-verify all recorded numbers. Any discrepancy between electronic memory and paper log requires immediate flag for re-measurement or invalidation.

#### 8.2 Real-Time Statistical Outlier Screening
The data ingestion pipeline applies real-time plausibility filters:
- Sprints: $10\text{m time} < 1.40\text{ s}$ or $> 2.60\text{ s}$ triggers warning flag for false trigger.
- Vertical Jump: $\text{CMJ} < 15.0\text{ cm}$ or $> 70.0\text{ cm}$ triggers sensor contact verification.
- Ball Velocity: $\text{Velocity} < 35.0\text{ km/h}$ or $> 135.0\text{ km/h}$ triggers radar angle check.
- Plausibility Rule: A second trial differing by $> 15\%$ from the first trial requires an immediate mandatory third trial.

#### 8.3 Data Confidentiality & Medical Privacy
1. Testing records are classified as confidential athlete medical/performance records.
2. Individual raw data is accessible only by authorized club coaches, sports scientists, and the athlete/parent.
3. Cross-academy comparisons must be de-identified and tenant-scoped.
