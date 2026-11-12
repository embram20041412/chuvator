# CHUVATOR — FOOTBALL SCOUTING COMBINE & ASSESSMENT BATTERY
## PHASE 3.0.2.2: SAFETY, TEST ORDER & DATA COLLECTION PROTOCOL

**Document Version:** 3.0.2.2  
**Auditor Role:** Independent Sports Testing Operations Auditor  
**Status:** OFFICIAL OPERATIONAL PROTOCOL  
**Data Integrity:** Strict Null Untested Preservation (No 0 Imputation)  

---

### 1. FATIGUE HIERARCHY & SAFETY-DRIVEN TEST SEQUENCING

Athlete testing safety and data reliability are governed by the **Bioenergetic Fatigue Hierarchy**. Performing tests in an incorrect sequence contaminates results and drastically elevates injury risk.

```
====================================================================================================
CHUVATOR COMBINE FATIGUE HIERARCHY (THE INVIOLABLE SEQUENCE)
====================================================================================================
Tier | Physiological Domain        | Energy System       | Typical Duration | Required Recovery
-----|-----------------------------|---------------------|------------------|------------------
1    | Resting / Anthropometric    | Basal Metabolic     | Static           | Zero
2    | Dynamic Mobility & Balance  | Neuromuscular / FMS | 15–30 seconds    | 30 seconds
3    | Alactic Vertical/Horiz Jump | ATP-PCr (Alactic)   | < 1.0 second     | 60–90 seconds
4    | Maximal Linear Acceleration | ATP-PCr (Alactic)   | 1.5–4.5 seconds  | 180–240 seconds
5    | Deceleration & COD Turning  | ATP-PCr + Eccentric | 2.0–3.0 seconds  | 180 seconds
6    | Technical Ball Striking     | High-Velocity Motor | Instantaneous    | 45–60 seconds
-----|-----------------------------|---------------------|------------------|------------------
REST | MANDATORY METABOLIC BREAK: 24 MINUTES PASSIVE REST & CARBOHYDRATE REPLENISHMENT
-----|-----------------------------|---------------------|------------------|------------------
7    | Intermittent Aerobic (Yo-Yo)| Aerobic Glycolysis  | 8–16 minutes     | 24–48 hours
8    | Repeated Sprint Ability RSA | Anaerobic Lactic    | 6 x 30m / 20s    | 48–72 HOURS (BAN!)
====================================================================================================
```

#### Inviolable Safety Rules:
1. **The Post-Sprinting Deceleration Rule:** Sprints must terminate in a minimum $20\text{m}$ clear run-through zone. Never place a wall, fence, or obstacle within $20\text{m}$ of the finish gate.
2. **The 48-Hour Aerobic/Anaerobic Separation Rule:** Yo-Yo IR1 and Repeated Sprint Ability ($6 \times 30\text{m}$ RSA) **MUST NEVER** take place on the same day. Conducting RSA after Yo-Yo IR1 leads to severe metabolic acidosis, acute hamstring failure, and distorted decrement scores.
3. **Age & Maturity Screening Safeguard:** Pre-pubertal athletes (Tier 1 and early Tier 2) are exempt from maximal lactic exhaustion tests.

---

### 2. RAW MEASUREMENT DATA COLLECTION SCHEMA

To ensure fail-closed data integrity and eliminate transcription errors, every single trial executed in the combine must be captured according to the following **12-Field Canonical Data Schema**:

```
+--------------------------------------------------------------------------------------------------+
|                            CHUVATOR COMBINE RAW MEASUREMENT RECORD SCHEMA                        |
+----+--------------------------+---------------+--------------------------------------------------+
| #  | Field Name               | Data Type     | Operational Definition & Validation Constraint   |
+----+--------------------------+---------------+--------------------------------------------------+
| 1  | athlete_id               | UUID / String | Unique canonical student identifier in academy.  |
| 2  | session_id               | String        | Standard event tag (e.g. 'SES-202611-COMBINE-01')|
| 3  | canonical_indicator_id   | String        | Exact canonical ID from registry (e.g. 'FTB-UNI- |
|    |                          |               | PHY-01'). Must match footballAssessmentData.js!  |
| 4  | protocol_version         | String        | SOP version under which tested ('3.0.2.2').      |
| 5  | attempt_number           | Integer       | Sequential trial index (1, 2, 3...).             |
| 6  | raw_result               | Float / Null  | Empirical measurement value (e.g. 1.74, 38.5).   |
|    |                          |               | STRICT RULE: Must be null if untested/invalid!   |
| 7  | unit                     | String (Enum) | Measurement unit: 's', 'cm', 'km/h', 'm', 'deg'. |
| 8  | validity_status          | String (Enum) | - 'VALID' (Clean trial according to SOP)         |
|    |                          |               | - 'INVALID_FAULT' (Athlete slipped, line breach) |
|    |                          |               | - 'INVALID_EQUIPMENT' (Photocell misaligned)     |
|    |                          |               | - 'DID_NOT_ATTEMPT' (Medical abort, withdrawal)  |
|    |                          |               | - 'UNTESTED' (Protocol excluded or not reached)  |
| 9  | equipment_id             | String        | Serial / asset tag of timing gate, mat, or radar |
| 10 | evaluator_id             | String        | Unique staff ID of testing sports scientist.     |
| 11 | timestamp                | ISO 8601 UTC  | Timestamp of trial completion.                   |
| 12 | notes_and_deviations     | String / Null | Environmental or physical notes (wind, turf, etc)|
+----+--------------------------+---------------+--------------------------------------------------+
```

---

### 3. STRICT PRESERVATION OF NULL AS UNTESTED

A primary vulnerability in sports analytics is the accidental coercion of missing values to zero. In CHUVATOR:

$$\mathbf{Missing\ Score\ \equiv\ UNTESTED\ (null)\quad \neq\quad Explicit\ 0\ (Valid\ Minimum)}$$

1. **Category Averaging Rule:**
   - If an athlete is tested on 3 out of 16 Physical indicators, the category average is computed strictly as:
     $$\text{Average} = \frac{\text{Score}_1 + \text{Score}_2 + \text{Score}_3}{3}$$
   - Dividing by 16 or treating the 13 untested indicators as 0 is **STRICTLY PROHIBITED** and violates the Phase 1 & Phase 2 acceptance contracts (`phase1Acceptance.test.js: Test A`).
2. **Explicit 0 vs Untested Null:**
   - If an athlete performs an attempt but achieves zero valid output (e.g., 0 completed wall tosses or 0 push-ups), the raw score is recorded as `0`.
   - If the test was excluded, not attempted, or aborted due to safety, the score must be stored as `null`.
   - The UI and analytics engine must display `null` as `"-"` or `"UNTESTED"`, never as `"0"`.

---

### 4. MULTI-TENANT ISOLATION & AUDIT SIGN-OFF

1. **Tenant Enclosure:** Every raw measurement record includes the authenticated academy `tenant_id`. No cross-academy data mixing is permitted during batch upload.
2. **Dual-Sign-Off Requirement:**
   - Prior to session closure, the **Station Evaluator** and **Field Scribe** cross-sign the hardcopy scorecards.
   - The **Lead Sports Scientist** reviews the automated outlier report (flagging any $|z| > 3.0$) and applies the digital cryptographic sign-off.
