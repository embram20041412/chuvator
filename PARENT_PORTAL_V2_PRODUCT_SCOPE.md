# CHUVATOR PARENT PORTAL V2 — PRODUCT SCOPE
**Document Version:** 2.0  
**Status:** ARCHITECTURE & SCOPE FROZEN  
**Mode Boundary:** READ-ONLY OPERATIONAL & FINANCIAL ACCESS  

---

## 1. PRODUCT PURPOSE & BOUNDARIES

CHUVATOR Parent Portal V2 is a dedicated, web-based self-service portal for parents/guardians of students at CHUA SPORT CORE academies. Its sole purpose is to provide parents with transparent, real-time visibility into their children's athletic training, schedule, attendance, progress, evaluations, and financial billing status, while enabling secure payment initiation integrated directly with the CHUA CORE Financial Engine.

### Core Philosophy & Boundary Principles:
1. **NOT an ERP or Accounting System**: Parent Portal does NOT manage academy operations, financial books, ledgers, or staff tasks.
2. **Integrated Financial Core (DECISION-04)**: All financial calculations, transaction recording, verification, overpayment tracking, and ledgers reside exclusively in CHUA CORE.
3. **Read-Only Operational & Financial Access (DECISION-06)**: Parents can view operational data (attendance, evaluations, schedules) and financial bills, but cannot modify operational records or alter payment statuses directly.
4. **Full Parent Dashboard (DECISION-05)**: Comprehensive dashboard covering student profiles, schedule, attendance, progress, evaluations, announcements, and billing.

---

## 2. DETAILED FEATURE BREAKDOWN BY PRIORITY

### P0 — MANDATORY CORE FEATURES (READ-ONLY VIEWING & AUTH)

| Feature | Description | Target User | Access Level |
| :--- | :--- | :--- | :--- |
| **Parent Authentication** | Secure login via Phone/Email with HttpOnly cookie session (`portal_session_v2`) and CSRF validation (`X-Portal-CSRF`). | Parent | Write (Session Init) |
| **Parent-Child Authorization** | Strict verification linking authenticated parent account (`parent_accounts`) to active student records (`parent_student_links`). | Parent | Read-Only |
| **Multi-Child Selector** | Switch between linked children without re-authenticating. | Parent | Read-Only |
| **Student Profile View** | View active student details (Name, ID, Age, Class, Academy Branch, Assigned Coach). | Parent | Read-Only |
| **Schedule & Session View** | View weekly practice sessions, location, time slots, and assigned instructors. | Parent | Read-Only |
| **Attendance Tracking** | View historical attendance rate, present/absent logs, and session dates. | Parent | Read-Only |
| **Evaluations & Progress** | View coach evaluation scores (Technique, Physical, Tactical, Mental) and progress reports. | Parent | Read-Only |
| **Achievements & Medals** | View tournament achievements, medals won, and official awards. | Parent | Read-Only |
| **Billing Summary** | View active unpaid monthly SPP fees, registration fees, and total outstanding bill. | Parent | Read-Only |
| **Payment History** | View verified past payment receipts and transaction records. | Parent | Read-Only |

---

### P1 — PAYMENT INITIATION & INTEGRATION (DECISION-04)

| Feature | Description | Source System | Access Level |
| :--- | :--- | :--- | :--- |
| **Bill Summary Display** | Display real-time outstanding balance and breakdown supplied by Financial Core. | Financial Core API | Read-Only |
| **Payment Initiation** | Request payment method (QRIS / Bank Transfer) for outstanding bills. | Financial Core API | Write (Initiation Request) |
| **QRIS Display** | Display dynamic/static QRIS code retrieved directly from academy tenant settings. | Financial Core API | Read-Only |
| **Bank Transfer Info** | Display official academy bank account details and copyable account numbers. | Financial Core API | Read-Only |
| **Transfer Proof Upload** | Upload transfer receipt (if supported by Financial Core manual verification flow). | Financial Core API | Write (Media Upload) |
| **Real-time Result Info** | Display payment verification result received from Financial Core callback/poll. | Financial Core API | Read-Only |

---

### P2 — ENHANCEMENT & PREFERENCE FEATURES

| Feature | Description | Priority | Status |
| :--- | :--- | :--- | :--- |
| **Announcement Reader** | View academy announcements, holiday notices, and event schedules. | P2 | Planned |
| **Parent Profile Preferences** | Update parent contact preferences, display theme, or language. | P2 | Planned |
| **PDF Evaluation Download** | Export evaluation card / report card to downloadable PDF format. | P2 | Planned |

---

## 3. EXPLICITLY PROHIBITED ACTIONS (OUT OF SCOPE)

The Parent Portal is strictly prohibited from executing or offering UI for the following actions:

- ❌ Modifying student attendance logs or marking present/absent.
- ❌ Editing coach evaluation scores, notes, or progress assessments.
- ❌ Modifying academy class schedules, time slots, or coach assignments.
- ❌ Creating, editing, or waiving student bills or registration fees.
- ❌ Modifying payment amounts, tendered change, or discount amounts.
- ❌ Manually approving, verifying, or marking payments as "LUNAS".
- ❌ Executing financial refunds, VOIDs, or journal entries.
- ❌ Creating a parallel ledger, wallet balance, or local payment storage.
