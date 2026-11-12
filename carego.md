# CareGo+ — Business & Product Documentation

> Derived from analysis of the `Cargo-UI` front-end prototype (static HTML + Tailwind CSS) and the demo data embedded in its pages.
> The project currently has **no backend or business logic in code** — the only JavaScript is tab/step switching. All rules below are inferred from UI copy, labels and the demo numbers.

---

## 1. What CareGo+ Is

CareGo+ is a **home-healthcare marketplace / agency platform for Bangladesh** (Dhaka first). It connects families with **verified caregivers, nurses and nannies** who deliver care at the patient's home, and manages the whole lifecycle: booking, admin matching, consent, staged payments, daily shift tracking and caregiver payouts.

| Item | Value |
|---|---|
| Market | Dhaka & Bangladesh |
| Currency | BDT (৳) |
| Local payment rails | bKash, Nagad, Rocket, Visa/Mastercard via SSLCommerz, Cash to Staff |
| Communication | SMS / WhatsApp / in-app notifications |
| Offices | Ka/7, Jagannathpur, Bashundhara Rd, Dhaka 1229 · Head Office: Ka-38, J. B. Tower, Pragati Sarani Rd, Dhaka 1229 |
| Contact | +8801315-092095, +8801739-508350, caregiveragencybd@gmail.com |
| Claimed traction (marketing) | 10,000+ families, 5,000+ caregivers, 50,000+ services completed, 4.8/5 rating, 24/7 support (About page shows a smaller 500+ / 100+ — see §10) |

### Actors

| Actor | Role |
|---|---|
| **User / Customer** (e.g. *Irfan Hossain*) | Family member who books services and manages one or more patients and payments. |
| **Patient** (e.g. *Abdul Karim, PT-1001*) | Care recipient. One user can hold many patients (father, child, etc.). |
| **Caregiver / Nurse / Nanny** (e.g. *Afia Islam*, *Farhana Akter*) | Field staff who perform shifts, log notes and collect cash. Has a separate **Caregiver Portal**. A caregiver can "Switch to User". |
| **Admin / CareGo+ Team** (e.g. *Anika Rahman*) | Confirms bookings, matches caregivers, verifies cash payments, writes patient notes, reconciles ledgers. (No admin UI exists yet.) |

---

## 2. Project Structure

```
src/
├── home/        Public marketing site: home, services (+ per-service pages), about, contact
├── auth/        login, registration (email/phone + Google/Facebook/Apple)
├── booking/     8-step booking wizard (step_1..step_8) + booking.html (all steps in one page)
├── dashboards/  Customer: my_bookings, my_patients
├── bookings/    Booking details tabs (overview, payment schedule, caregiver, address, timeline) + combined booking_details.html
├── patients/    Patient details tabs (overview, bookings, documents, notes), payment & billing overview, billing details
└── Caregiver/   Caregiver portal (mobile-first): schedule, bookings, booking/shift details, earnings, accounts & ledger
```

Brand colors: teal `#007D5A / #008561`, light teal `#E6F3F0`, orange `#FF8A00`, dark `#1F2937`. Font: Inter.

---

## 3. Service Catalogue

Three live service categories, each with **Basic / Standard / Premium** tiers. Physiotherapy is marked **"Coming Soon"**. Marketing also lists Doctor Home Visit, Oxygen Cylinder, Medical Equipment and Baby Care.

### 3.1 Home Caregiver

| Attribute | Basic | Standard | Premium (Live-in) |
|---|---|---|---|
| Staffing | 1 field caregiver | 1 primary + 1 assistant caregiver | 1 primary + 1 assistant |
| Allowed days | 1, 7, 30 | 7, 15, 30 | 7, 15, 30 |
| Hours/day | 8, 12, 24* | 8, 12, 24* | 24 (full live-in)** |
| Personal care, companionship, medication reminders | ✔ | ✔ | ✔ |
| Toilet management, dementia/geriatric support, post-hospital aid, health screening | ✖ | ✔ (tier-dependent) | ✔ |
| Doctor follow-up | — | — | 1 visit/month (min. 15-day booking) |

\* 24-hour assisted coverage includes scheduled rest. \** Live-in includes reasonable rest/sleep for staff.

### 3.2 Home Nursing
Staffed by a **licensed BSc/Diploma Registered Nurse (RN)**; higher tiers add a caregiver assistant. Includes vitals tracking (RBS, BP, pulse, SpO₂), IV cannula, injections/saline (strictly per prescription), nebulization, oxygen, medication management. Higher tiers add urinary catheter care, NG tube feeding, wound dressing, critical patient support, monthly digital health report and 1 monthly physician visit (min. 15 days).

### 3.3 Nanny Service
| Basic | Standard | Premium |
|---|---|---|
| ৳1,200/day | ৳1,500/day | ৳1,900/day |

Personal care, feeding, bottle feeding, hygiene, educational/creative activities, room tidying. Duration 1/7/15/30 days, shifts 8/12/24 h.

### 3.4 Generic package pricing (booking wizard)
| Package | Price | Includes |
|---|---|---|
| Basic Care | ৳1,000/day | Personal care, meal prep, medication reminders, companionship |
| Standard Care | ৳1,500/day | Basic + vitals monitoring, light housekeeping, mobility assistance |
| Premium Care | ৳2,000/day | Standard + specialized support, 24/7 availability, care plan management |

### 3.5 Add-ons (charged per day)
| Performed by | Add-ons |
|---|---|
| **A. Registered Doctor (MBBS)** | Doctor follow-up (৳500/day), NG tube insertion, urinary catheter insertion |
| **B. BSc/Diploma Nurse** | IV cannula care, injections (IM/IV/SC) & saline, vitals monitoring, nebulization, oxygen inhalation |
| **C. Caregiver** | Report collection (৳500/day), sample collection, in-hospital care (Basic/Standard/Premium) |

"Everyday Care" included in all plans: vitals tracking, medication reminders, mobility support, hygiene care.

---

## 4. Customer Journey

1. **Configure** — pick service, tier, hours/day (8/12/24) and duration (1/7/15/30 days).
2. **Verify** — log in, complete **2-minute NID + selfie KYC** (mandatory before any booking), enter patient details.
3. **Admin matching & consent** — admin confirms and assigns caregiver team; user accepts consent and pays a **30% digital deposit**.
4. **In-home assessment** — on day one the caregiver **checks in via GPS** and runs a "Phase 2" medical/functional assessment that drives daily care logs.

### 4.1 Booking Wizard (8 steps)
| # | Step | Captured data |
|---|---|---|
| 1 | Service & Package | Category (Caregiver / Nursing / Nanny), tier |
| 2 | Schedule | Total days, hours/day, start date, start time (06:00–20:00, 2-hour slots) |
| 3 | Patient Info | Name, age, gender, weight, address, medical condition, status (Mobile / Bedridden); primary attendant + relationship + WhatsApp number; optional secondary contact |
| 4 | Add-ons | Per-day extras (§3.5) |
| 5 | Consent | 7 mandatory clauses (§6) |
| 6 | Payment Structure | 30% upfront + remaining 70% plan (§5) |
| 7 | Review & Confirm | Summary → "Book Service" |
| 8 | Completed | Booking ID issued, status **Awaiting Admin Confirmation** |

A live **Booking Summary** sidebar recalculates totals on every step.

---

## 5. Pricing & Payment Rules

### 5.1 Price formula
```
Adjusted price/day = Base package price × (Hours per day ÷ Base hours)
Service subtotal   = Adjusted price/day × Total days
Add-ons total      = Σ (add-on price/day) × Total days
Service fee        = 5% × (Service subtotal + Add-ons total)
Total amount       = Service subtotal + Add-ons total + Service fee
```

### 5.2 Worked demo example — booking `CG-250525-00123`
Home Caregiver · Basic Care · 24 h/day · 30 days · start 25 May 2025 10:00 AM · add-on *Report Collection*.

| Line | Amount |
|---|---|
| Base ৳1,000 × 30 days | ৳30,000.00 |
| Report Collection ৳500 × 30 days | ৳15,000.00 |
| Subtotal | ৳45,000.00 |
| Service fee 5% | ৳2,250.00 |
| **Total** | **৳47,250.00** |
| Upfront deposit 30% | ৳14,175.00 |
| Remaining 70% | ৳33,075.00 |

### 5.3 Payment structure
- **30% upfront is mandatory**, paid **only after admin confirmation** (customer is notified; "pay within 24 hours to start the service").
- Remaining **70%** in one of:
  | Option | Demo value |
  |---|---|
  | All together | ৳33,075.00 once |
  | Weekly | ৳8,268.75 × 4 weeks (17.5% each) — due 26 May, 02 Jun, 09 Jun, 16 Jun 2025 |
  | Daily | ৳1,102.50 × 30 days |
- Due dates are indicative and shift with the service start date.
- Channels: online (bKash, Nagad, card via SSLCommerz) or **Cash to Staff**. Cash payments show **"Pending Verification"** until admin reconciles. Receipts/invoices are issued for every payment.
- Payment statuses seen: `Paid`, `Partial Paid (30%)`, `Due Now`, `Upcoming`, `Pending`, `Scheduled`, `Pending Verification`, `Success`, `Failed / Disputed`.

---

## 6. Consent (7 clauses, all required)
1. Consent for services per the selected plan.
2. Medical responsibility — info is accurate; CareGo+ staff are **not doctors**.
3. Emergency & hospital transfer authorization.
4. Staff safety & working environment — abusive/unsafe behaviour may end the service.
5. Payment, refund & replacement policy.
6. Liability limitation (no indirect/consequential damages).
7. Truthfulness declaration.

---

## 7. Booking Lifecycle

```
Pending (Awaiting admin confirmation)
  → Confirmed (pay 30% upfront)
    → Payment Received (30%)
      → Caregiver(s) Assigned
        → In Progress (sessions tracked, e.g. 0/30; payments e.g. 1/4)
          → Completed
Any pre-completion state → Cancelled
```
Demo timeline: placed 09:15 → confirmed 09:20 → 30% paid 09:22 → caregivers assigned 09:25 (24 May 2025).

Booking details tabs: **Overview · Payment Schedule · Caregiver Details · Service Address · Activity Timeline**, plus *Cancel Booking* and *View Invoice*.

Demo "My Bookings" list:
| Booking | Duration | Amount | Paid | Status |
|---|---|---|---|---|
| CG-250525-00123 | 30 d × 24 h | ৳47,250 | ৳0 | Pending |
| CG-250515-00098 | 15 d | ৳23,655 | ৳7,096.50 (30%) | Confirmed |
| CG-250505-00076 | 20 d | ৳31,400 | ৳9,420 (30%) | In Progress |
| CG-250401-00056 | 7 d × 12 h | ৳10,290 | — | Completed |
| CG-250410-00065 | 10 d | ৳15,750 | — | Cancelled |

---

## 8. Patient Management

Each patient (ID `PT-xxxx`) has tabs **Overview · Bookings · Documents · Notes**.

- **Overview** — basic info (NID/birth cert no., blood group, contacts), emergency contacts, medical info (diagnosis, chronic conditions: diabetes, hypertension, heart/kidney disease, asthma/COPD, paralysis, psychiatric), **infection risk screening** (Hepatitis B/C, TB, COVID/flu, contagious disease), allergies, **functional assessment** (mobility, toilet support, feeding, mental status, behavioural risk), care requirements, hospital/doctor info.
- **Documents** — categorized uploads: Discharge Summary, Prescriptions, Investigation Reports, ID Proofs, Others.
- **Notes** — timeline of notes by CareGo+ team (initial assessment → medication reminder → follow-up → care plan discussion).
- **Bookings** — per-patient bookings with progress bar (Placed → Confirmed → Payment → Assigned → Started → Ended), sessions and installments counters, total spent.

Demo patients: Abdul Karim (PT-1001, 72 M, active), Rokeya Begum (PT-1002, 68 F, physiotherapy), Mofiz Uddin (PT-1003, 65 M, completed).

**Payment & Billing** page: saved methods (bKash, Nagad, Visa, Mastercard), active services, transaction history, monthly overview (demo: paid ৳13,200, outstanding ৳16,800).

---

## 9. Caregiver Portal

Navigation: Dashboard · Schedule · Bookings · Earnings · Accounts & Ledger · Support · Settings · *Switch to User*.

### 9.1 Shift operations
- Weekly calendar schedule; shift card shows patient, diagnosis, care directives.
- **GPS check-in / check-out** with timestamps (demo: shift 08:00–20:00, checked in 08:02).
- **Concurrent shifts** — 2 caregivers on site together (e.g. with *Rupa A.*), and **handover** to the next caregiver (*Shazid Ahmed* at 20:00). "Request Handover" action.
- Shift notes / observations (e.g. vitals: BP 128/78, pulse 76, SpO₂ 96%).
- **Log Cash Received (৳)** per session — the caregiver can collect payment from families.
- Booking detail tabs: Responsibilities · Medical Information · Patient Profile · Care Plan · Payment. "End Session" action.

### 9.2 Earnings model
- Caregiver is paid **per hour** (demo: ৳500/hr) or per shift.
- **CareGo+ commission ≈ 10%** of gross (demo: ৳3,500 → fee ৳350 → net ৳3,150; ৳45,000 → ৳4,500 → ৳40,500).
- Balances: *Available to Withdraw*, *Pending Clearance* (3–5 business days), monthly total; 6-month trend chart; CSV export.
- Transaction statuses: Completed, Withdrawn, Pending.

### 9.3 Accounts & Ledger (cash reconciliation)
Because families may pay **cash to the caregiver**, the platform keeps a double-entry ledger:

| Metric | Demo | Meaning |
|---|---|---|
| Cash in Hand (Owed) | ৳4,200 | Cash collected that belongs to the platform |
| Digital Earnings (Held) | ৳14,500 | Earnings from digital payments |
| **Net Standing Balance** | **+৳10,300** | Digital earnings − cash owed → available for payout |

Settlement options: **auto-deduct from earnings** or **direct pay** via bKash/Nagad/Rocket. Ledger rows have Debit/Credit/Balance and statuses `Reconciled`, `Pending Sync`, `Settled`. Flows: Cash Collected, Withdrawal, Internal (commission adjustment), Digital Credit. Home page mentions **"cash safety thresholds"** — a cap on how much cash a caregiver may hold.

---

## 10. Trust & Safety Framework
1. **Identity KYC** — real-time selfie biometric + NID match, mandatory for users *and* caregivers.
2. **Professional screening** — education, clinical registry/experience, references, optional police clearance.
3. **Platform accountability** — 24/7 admin monitoring, GPS check-ins, emergency response, secure payments & cash thresholds.

Also: backup caregiver network for replacements, ability to request the same caregiver again, caregiver ratings (e.g. 4.8 from 126 reviews), address shared only with assigned caregivers.

---

## 11. ID Conventions (from demo data)
| Entity | Format | Example |
|---|---|---|
| Customer booking | `CG-YYMMDD-NNNNN` | CG-250525-00123 |
| Billing booking / invoice | `CGP-NNNNN[-NN]` | CGP-99281-03 |
| Caregiver booking | `BK-YYYY-MMDD-NNN` | BK-2026-0604-001 |
| Package | `CGP-NNN` | CGP-992 |
| Patient | `PT-NNNN` | PT-1001 |
| Ledger refs | `CG-BOK-` / `CG-PAY-` / `CG-ADJ-` | CG-PAY-11002 |

These should be unified before backend work.

---

## 12. Inconsistencies Found in Demo Data (to resolve)

1. **Price multiplier base** — steps 2–5 treat the base price as per **8 hours** (×3 for 24 h → ৳90,000 subtotal, ৳1,10,250 total) while steps 6–8 treat it as per **24 hours** (×1 → ৳30,000, total ৳47,250). The business must decide the base unit.
2. **Allowed days** — Basic Care allows 1/7/30 days but the wizard offers 1/7/15/30 with no tier restriction; the 15-day minimum for doctor follow-up is not enforced.
3. Same booking `CG-250525-00123` appears as **Basic** and **Standard** Care on different tabs, and with **Rahima Begum** (Dhanmondi) as the patient in one place and **Abdul Karim** (PT-1001) in another; service address shows **Mirpur DOHS**.
4. Payment counters say **"1 / 4 payments"** but the plan has 5 payments (1 deposit + 4 weekly). Timeline says next due **08 Jun** while schedule says **26 May**.
5. Basic Care shows "Most Popular" badge (likely meant Standard).
6. Physiotherapy is "Coming Soon" yet appears in patient bookings and billing; a **Cleaning Service** appears in billing but isn't in the catalogue.
7. Caregiver booking detail: ৳500/hr × 12 h = ৳6,000, fee ৳1,080 (18%), shown net ৳4,830 — doesn't add up and conflicts with the 10% fee elsewhere.
8. Nanny prices (৳1,200/1,500/1,900) differ from wizard generic packages (৳1,000/1,500/2,000).
9. Mixed demo years (2023, 2025, 2026), name spelling (Irfan Hossain / Hussain), and differing traction numbers (About: 500+ families vs Home: 10,000+).
10. Billing details timeline mixes payment methods within one package (Nagad, bKash, Cash, Visa, Mastercard) with amounts that don't sum to the package price (৳5,600).

---

## 13. Suggested Next Steps for Development
- Define data models: `User`, `Patient`, `Caregiver`, `Service`, `Package`, `AddOn`, `Booking`, `Shift`, `Payment/Installment`, `LedgerEntry`, `Document`, `Note`, `Consent`.
- Implement the pricing engine (§5) as a single source of truth shared by the wizard and booking details.
- Build the **Admin panel** (booking confirmation, caregiver matching, cash verification, ledger reconciliation) — referenced everywhere but not yet designed.
- Integrate KYC, SSLCommerz/bKash/Nagad, GPS check-in and SMS/WhatsApp notifications.
- Resolve §12 before treating demo numbers as specs.
