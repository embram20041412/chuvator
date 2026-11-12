# CHUVATOR — FOOTBALL SCOUTING COMBINE & ASSESSMENT BATTERY
## PHASE 3.0.2: PILOT TESTING PLAN & OPERATIONAL FEASIBILITY

**Document Version:** 3.0.2  
**Status:** APPROVED FOR CONTROLLED PILOT EXECUTION — PRE-SCORING ENGINE  
**Classification:** Operational Field Deployment & Quality Assurance Plan  
**Target Venue:** Standardized Football Academy Training Ground / Sports Arena  

---

### 1. OBJECTIVE & SCOPE OF THE PILOT

The primary objective of the CHUVATOR Scouting Combine Pilot is to **empirically validate operational feasibility, workflow timing, equipment reliability, data capture integrity, and inter-rater reliability (IRR)** under realistic Indonesian academy field conditions before rolling out across multi-tenant academies.

#### 1.1 Non-Negotiable Scientific Guardrails
1. **No Premature Scoring Engine Deployment:** The pilot measures and records **raw empirical values only** (seconds, centimeters, km/h, meters, repetitions). No conversion to 1–100 scaled scores or percentile rankings will take place during this pilot.
2. **Strict Single Source of Truth:** All recorded data must attach strictly to the canonical indicator IDs defined in `src/config/footballAssessmentData.js`.
3. **Maturity & Age Decoupling:** Biological maturity (Mirwald maturity offset) and chronological age must be captured independently. Missing date of birth results in `AGE_UNVERIFIED` and excludes the athlete from age-normed descriptive analyses.
4. **Sample Size Scope Discipline:**
   - **Pilot Cohort ($N = 36$ athletes):** Evaluates operational station throughput, equipment calibration, protocol adherence, safety, and test-retest reliability.
   - **Intermediate Internal Cohort ($N = 100–200$ athletes):** Supports preliminary exploratory descriptive analytics within a single academy tenant.
   - **Regional/National Normative Database ($N \ge 600–1,000$ athletes):** Required before establishing statistically robust normative percentile lookup tables stratified by age, maturity offset, and position.

---

### 2. AUDIT & REBUTTAL OF PREVIOUS OPERATIONAL ESTIMATES

Previous naive combine planning assumed that 20 athletes could be tested through 8 test protocols sequentially on a single station by 1–2 coaches in ~60 minutes. A rigorous mathematical time-motion analysis reveals this assumption to be physically impossible and dangerous:

```
========================================================================================
MATHEMATICAL AUDIT: LINEAR SINGLE-STATION (NAIVE) VS. 4-STATION PARALLEL (CHUVATOR)
========================================================================================

A. SINGLE-STATION LINEAR TESTING (20 Athletes, 8 Tests sequentially on 1 station)
   - Setup & explanation per test               : 8 tests x 5 min            = 40 min
   - Anthropometry & Intake (20 athletes)        : 20 x 3 min                 = 60 min
   - CMJ Jump Test (20 athletes x 3 trials + rest): 20 x 3.5 min              = 70 min
   - Broad Jump (20 athletes x 3 trials)         : 20 x 2.5 min               = 50 min
   - 10m & 30m Sprints (20 athletes x 2 trials with mandatory 4-min rest)     = 90 min
   - 505 COD Test (20 athletes x 4 trials with mandatory 3-min rest)          = 90 min
   - Radar Kick Test (20 athletes x 6 trials + ball retrieval)                = 50 min
   - Total Linear Time Required                  : 450 minutes (~7.5 HOURS!)
   - VERDICT: SEVERE FAILURE. Extreme fatigue, loss of focus, and high injury risk.

B. CHUVATOR AUDITED 4-STATION PARALLEL CIRCUIT (20 Athletes in 4 squads of 5 athletes)
   - Station 0: Intake, Screening & Anthropometry (50cm box, stadiometer): 25 min
   - Central Zone: Standardized RAMP Warm-Up (Raise, Activate, Mobilize, Potentiate): 20 min
   - Balanced 4-Station Circuit Rotation ($4 \times 22\text{ min} + 8\text{ min}$ transition buffer): 96 min
     * Station 1: Mobility & Balance (WBLT Ankle + Y-Balance Lower Quarter)
     * Station 2: Lower-Body Power (CMJ Contact Mat + Standing Broad Jump)
     * Station 3: Linear Speed (10m & 30m Dual-Beam Photogate Splits)
     * Station 4: COD & Technical (505 COD Test + Doppler Radar Kick Test)
   - Mandatory Rehydration & Carbohydrate Recovery Break: 24 min
   - Terminal Aerobic Phase (Yo-Yo IR1 in 2 Heats of 10): 30 min
   - Total Combine Duration: **165 MINUTES (~2.75 HOURS)**
   - VERDICT: PASS. Eliminates Station 1 bottleneck; guarantees full neuromuscular recovery between sprint and jump trials.
========================================================================================
```

---

### 3. PILOT COHORT ARCHITECTURE & STRATIFICATION

The pilot study deploys **$N = 36$ youth male football players** divided into two equal developmental cohorts to test protocol sensitivity across different developmental stages:

```
+---------------------------------------------------------------------------------------+
|                              PILOT COHORT STRATIFICATION                              |
+--------------------------+------------------------------+-----------------------------+
| Parameter                | Cohort A: Development (T2)   | Cohort B: Adv Development (T3)|
+--------------------------+------------------------------+-----------------------------+
| Number of Athletes       | $N = 18$                     | $N = 18$                    |
| Chronological Age Target | 11.5 – 13.0 years            | 14.5 – 16.0 years           |
| Target Maturity Phase    | Pre-PHV (Maturity Offset <-1)| Circa/Post-PHV (Offset >0)  |
| Squad Division           | 2 squads of 9 (Squad A1, A2) | 2 squads of 9 (Squad B1, B2)|
| Selected Core Battery    | 7 Core Tests (No RSA)        | 8 Core Tests (Includes YYIR1)|
+--------------------------+------------------------------+-----------------------------+
```

---

### 4. AUDITED FIELD STATION ARCHITECTURE & CIRCUIT TIMING

The combine operates as a **Synchronized 4-Station Parallel Circuit** with a dedicated Intake/Anthropometry Station and an isolated Metabolic/Aerobic block.

```
                     [ENTRANCE & REGISTRATION DESK]
                                   │
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │  STATION 0: INTAKE, ANTHROPOMETRY & SCREENING     │
          │  - Stadiometer (Standing & Sitting Height)       │
          │  - Digital Medical Scale (Body Mass)             │
          │  - Mirwald Maturity Offset Calculation           │
          │  - PAR-Q+ Health Screen & Resting HR             │
          └────────────────────────┬─────────────────────────┘
                                   │
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │  CENTRAL ZONE: STANDARDIZED RAMP WARM-UP         │
          │  18–20 Minutes (Raise, Activate, Mobilize, Pot.) │
          └────────────────────────┬─────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ STATION 1: MOBILITY & BALANCE│            │ STATION 2: EXPLOSIVE POWER   │
│ - WBLT Ankle Dorsiflexion    │            │ - CMJ Vertical Jump Height   │
│ - Y-Balance Lower Quarter    │            │ - Standing Broad Jump (cm)   │
│ Staff: 1 Evaluator + 1 Scribe│            │ Staff: 1 Evaluator + 1 Scribe│
│ Capacity: 4–5 athletes (22m) │            │ Capacity: 4–5 athletes (18m) │
└──────────────┬───────────────┘            └──────────────┬───────────────┘
               │                                           │
               ▼                                           ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ STATION 3: LINEAR SPEED      │            │ STATION 4: COD & KICK SPEED  │
│ - 3 Dual-Beam Timing Gates   │            │ - 505 COD Test (Right & Left)│
│ - Integrated 10m Accel Split │            │ - COD Deficit Calculation    │
│ - 30m Flying Speed Split     │            │ - Doppler Radar Ball Kick    │
│ Staff: 1 Evaluator + 1 Scribe│            │ Staff: 1 Evaluator + 1 Scribe│
│ Capacity: 4–5 athletes (20m) │            │ Capacity: 4–5 athletes (22m) │
└──────────────┬───────────────┘            └──────────────┬───────────────┘
               │                                           │
               └───────────────────┬───────────────────────┘
                                   │
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │  RECOVERY & REHYDRATION ZONE (24 MIN BREAK)      │
          │  Fluid replenishment, electrolyte snack, vitals  │
          └────────────────────────┬─────────────────────────┘
                                   │
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │  STATION 5: AEROBIC INTERMITTENT ENDURANCE       │
          │  - Yo-Yo Intermittent Recovery Level 1 (YYIR1)   │
          │  - Conducted as single group test (Max 10/heat)  │
          │  - STRICT RULE: NO RSA ON SAME DAY! (30 min)     │
          └──────────────────────────────────────────────────┘
```

#### 4.1 Station Workload & Timing Budget
- **Squad Size:** 4 to 5 athletes per station squad.
- **Rotation Duration:** **22 minutes per station**.
- **Athlete Throughput at Station 3 (Sprint Station as Pacing Benchmark):**
  - 5 athletes $\times 2$ trials $= 10$ sprints total.
  - Sprint duration: $\sim 4.5\text{ s}$ per run.
  - Reset and return walk: $45\text{ s}$.
  - Staggered start every $60\text{ s}$ allows each athlete a full **$4\text{ minutes}$ of rest between their 2 trials** while keeping the station constantly active ($10\text{ sprints} \times 1\text{ min} = 10\text{ min}$ run time $+ 10\text{ min}$ buffer).
  - Total station time: **20 minutes**.

---

### 5. PILOT RESOURCE ALLOCATION & EQUIPMENT CHECKLIST

#### 5.1 Personnel Requirements (Total: 8 Qualified Staff)
1. **Lead Sports Scientist (1):** Oversees combine governance, environmental monitoring (WBGT heat index), anomaly resolution, and protocol fidelity.
2. **Station Evaluators (4):** Exercise physiologists or certified S&C coaches (minimum AFC Fitness Coaching Level 1 / CSCS / Sarjana Olahraga) operating timing gates, jump mats, and radar equipment.
3. **Field Data Scribes (2):** Dual-entry logging officers responsible for physical card verification and real-time applet entry.
4. **Certified Sports Physiotherapist / First Aider (1):** Manages pre-screening, acute injury response, and on-pitch medical safety.

#### 5.2 Complete Equipment Manifest

| Equipment Item | Model / Specification Standard | Quantity | Station Allocation | Calibration Check |
|---|---|:---:|---|---|
| Wall Stadiometer & Box | Seca 216 ($0.1\text{ cm}$ graduation) + 50cm Box | 1 | Station 0 (Intake) | Spirit level plumb verification |
| Digital Medical Scale | Seca 874 Calibrated Digital Scale | 1 | Station 0 (Intake) | 10.0 kg reference test weight |
| Dual-Beam Timing Gates | Microgate Witty / Smartspeed Wireless | 3 pairs | Station 2 (Sprint) & Station 3 (505)| Laser alignment & zero trigger test |
| Optical Jump System | Optojump Next / Just Jump Contact Mat | 1 unit | Station 1 (Power) | Level surface zero balance |
| Y-Balance Kit | Move2Perform Lower Quarter Kit | 1 unit | Station 1 (Balance)| Slide smoothness & tape scale |
| Doppler Radar Gun | Stalker Sport 2 / Bushnell Speedster III | 1 unit | Station 4 (Kick) | Tuning fork frequency check |
| Heavy-duty Tripod | Manfrotto Pro 055 with 3-way head | 1 unit | Station 4 (Kick) | Height lock at $0.50\text{ m}$ |
| Digital Inclinometer | Baseline Digital Clinometer ($0.1^\circ$) | 1 unit | Station 1 (Mobility)| Vertical reference calibration |
| Standardized Match Balls | FIFA Quality Pro Size 4 (T2) & Size 5 (T3) | 8 balls | Station 4 (Kick) | Pressure gauge to $0.80\text{ bar}$ |
| High-Output PA Speaker | JBL EON One Compact ($\ge 110\text{ dB}$) | 1 unit | Station 5 (Endurance)| Audio calibration beep check |
| Field Cones & Marker Tape | Heavy rubber disc cones & 3M floor tape | 50 units| All stations | Distance verification with steel tape |
| Steel Measuring Tape | Lufkin $50\text{ m}$ fiberglass/steel tape | 2 units | All stations | Traceable standard |

---

### 6. SAFETY, READINESS SCREENING & CONTRAINDICATIONS

#### 6.1 Pre-Participation Screening Flow
Prior to warm-up, every athlete must complete a 3-step intake screen:
1. **PAR-Q+ Questionnaire Review:** Verified signed parent/guardian health consent.
2. **Resting Vitals:** Resting Heart Rate $<100\text{ bpm}$; resting Blood Pressure $<140/90\text{ mmHg}$.
3. **Acute Musculoskeletal Screen:** Zero current lower-extremity pain ($0/10$ on Visual Analog Scale) during active bodyweight squat and single-leg hop.

#### 6.2 Absolute Contraindications (Immediate Testing Disqualification)
- Current symptoms of fever, respiratory infection, or viral illness within prior 7 days.
- Acute ligament sprain or muscle strain $<21$ days post-injury without medical clearance.
- Known undiagnosed cardiac murmur, syncope during exercise, or family history of sudden cardiac arrest.
- Environmental WBGT $>32.2^\circ\text{C}$ (testing suspended per heat policy).

---

### 7. TEST-RETEST RELIABILITY & INTER-RATER AUDIT DESIGN

To prove the reproducibility of the testing battery, the pilot includes a **7-Day Test-Retest Reliability Study**:

```
+---------------------------------------------------------------------------------------+
|                    7-DAY TEST-RETEST RELIABILITY SUB-STUDY DESIGN                     |
+--------------------------+------------------------------------------------------------+
| Parameter                | Standardized Protocol                                      |
+--------------------------+------------------------------------------------------------+
| Sample Size              | Sub-sample of $N = 16$ athletes (8 from T2, 8 from T3)     |
| Re-Test Timing           | Exactly 7 days after initial test (+/- 1 hour of day)      |
| Environmental Match      | Same pitch surface, identical footwear, similar temperature|
| Blinding Protocol        | Evaluators blinded to Day 1 scores during Day 2 testing    |
| Statistical Target       | - Intraclass Correlation Coefficient: $\text{ICC}(3,1) > 0.85$|
|                          | - Typical Error of Measurement: $\text{CV} \le 3.0\%$      |
|                          | - Minimal Detectable Change (MDC) calculated at $95\%$ CI  |
+--------------------------+------------------------------------------------------------+
```

#### 7.1 Mathematical Reliability Formulas
1. **Intraclass Correlation Coefficient ($\text{ICC}(3,1)$ — Two-Way Mixed Single Measure):**
   $$\text{ICC}(3,1) = \frac{\text{MS}_S - \text{MS}_E}{\text{MS}_S + (k - 1)\text{MS}_E}$$
2. **Typical Error / Coefficient of Variation ($\text{CV}\%$):**
   $$\text{TE} = \frac{\text{SD}_{\text{diff}}}{\sqrt{2}},\quad \text{CV}\% = \left(\frac{\text{TE}}{\text{Grand Mean}}\right) \times 100$$
3. **Minimal Detectable Change at 95% Confidence ($\text{MDC}_{95}$):**
   $$\text{MDC}_{95} = \text{TE} \times 1.96 \times \sqrt{2} = 2.77 \times \text{TE}$$

Any test demonstrating $\text{CV} > 5.0\%$ or $\text{ICC} < 0.80$ will be flagged as **UNSTABLE PROTOCOL** and marked `REQUIRES SCIENTIFIC VALIDATION` prior to subsequent phases.

---

### 8. DATA QUALITY CONTROL & AUDIT PROCEDURE

#### 8.1 Real-Time Dual-Entry Reconciler
1. Field scribe inputs raw test results onto paper score sheets.
2. Station evaluator simultaneously inputs results into the local digital staging log.
3. At the end of each squad rotation, both records are compared.
4. Any mismatch $>0.01\text{ s}$, $>0.5\text{ cm}$, or $>0.5\text{ km/h}$ triggers immediate data freeze and consultation with the raw equipment memory buffer.

#### 8.2 Automated Statistical Anomaly Filters ($z$-Score Outlier Screening)
Upon batch submission, raw values are evaluated against standardized physiological bounds:

| Metric | Minimum Plausible Bound | Maximum Plausible Bound | Outlier Flag Threshold |
|---|---|---|---|
| $10\text{m}$ Acceleration Time | $1.45\text{ s}$ | $2.60\text{ s}$ | $|z| > 3.0$ within age cohort |
| $30\text{m}$ Flying Speed Time | $0.95\text{ s}$ | $1.80\text{ s}$ | $|z| > 3.0$ within age cohort |
| CMJ Jump Height | $18.0\text{ cm}$ | $65.0\text{ cm}$ | Flight time $<380\text{ ms}$ or $>725\text{ ms}$ |
| Standing Broad Jump | $120.0\text{ cm}$ | $290.0\text{ cm}$ | Discrepancy $>35\text{ cm}$ between trials |
| Instep Kick Exit Velocity | $45.0\text{ km/h}$ | $125.0\text{ km/h}$ | Radar angle deviation flag |
| Y-Balance Composite | $65.0\%$ | $125.0\%$ | Bilateral asymmetry $>15.0\text{ cm}$ |

Flagged scores are placed in `STAGING_REVIEW` and must be signed off by the Lead Sports Scientist before archiving.
