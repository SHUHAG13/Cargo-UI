# CareGo+ — Business & Product Documentation

CareGo+ is a home-healthcare marketplace for Bangladesh. Families book a **caregiver**, **nurse** or **nanny** by the day; vetted providers are assigned by an admin, check in with GPS, log vitals and notes, and are paid out after a clearance period. This document describes the business rules as they are implemented in the Angular app (`carego-app`). The original static HTML prototype has been removed.

## 1. Actors and demo accounts

| Role | Portal | Demo login (password `demo1234`) |
|---|---|---|
| Customer (`user`) | `/app` | `customer@carego.demo` |
| Caregiver (`caregiver`) | `/caregiver` | `caregiver@carego.demo` |
| Admin (`admin`) | `/admin` | `admin@carego.demo` |

Anyone can also register as a customer. Caregivers join through **Become a Caregiver** (an application an admin approves).

## 2. Service catalogue and pricing

Three categories, each with three tiers. **The price per day is the price for 24 hours.**

| Category | Basic | Standard | Premium |
|---|---|---|---|
| Home Caregiver | ৳1,000 | ৳1,500 | ৳2,000 |
| Home Nursing (placeholder prices) | ৳1,000 | ৳1,500 | ৳2,000 |
| Nanny | ৳1,200 | ৳1,500 | ৳1,900 |

Allowed durations and shift lengths:

| | Days | Hours/day | Assistant |
|---|---|---|---|
| Caregiver/Nursing Basic | 1, 7, 30 | 8, 12, 24 | no |
| Caregiver/Nursing Standard | 7, 15, 30 | 8, 12, 24 | yes |
| Caregiver/Nursing Premium | 7, 15, 30 | 24 only | yes |
| Nanny (all tiers) | 1, 7, 15, 30 | 8, 12, 24 | no |

"Most Popular" is on Standard. Physiotherapy is not offered. Add-ons (per day) are performed by a Doctor, a Nurse or the Caregiver; a doctor follow-up add-on needs a booking of at least 15 days.

### Price formula

```
adjusted price/day = base × hours ÷ 24
subtotal           = adjusted price/day × days + add-ons
service fee        = 5% of subtotal
total              = subtotal + service fee
```

## 3. Payment structure

- **30 % upfront deposit**, due within **24 h of admin confirmation**; otherwise the booking lapses.
- The remaining **70 %** is split by frequency: weekly (bookings of 14+ days), daily (2+ days) or together.
- Installments carry `paidAmount` and `pendingAmount`, so counters ("2 of 5 paid") and the next due date always agree with the timeline.
- Methods: bKash, Nagad, Rocket, Card (Luhn-checked; test card `4000 0000 0000 0002` is declined), or **Cash to Staff**, which sits in *pending verification* until an admin confirms it.

## 4. Booking lifecycle

`Pending Approval → Confirmed (awaiting deposit) → Confirmed (paid) → In Progress → Completed`, with `Cancelled`, `Rejected` and `Lapsed` as exits.

1. **Customer** completes KYC (NID of 10/13/17 digits + selfie), then the 8-step wizard: Service, Schedule, Patient, Add-ons, Consent (7 clauses), Payment structure, Confirmation, Review.
2. **Admin** confirms or rejects. Confirmation starts the 24 h deposit clock.
3. **Customer** pays the deposit and later installments.
4. **Admin** assigns a primary caregiver (and an assistant where the tier needs one); conflicts and inactive caregivers are blocked.
5. **Caregiver** checks in (GPS), records vitals and notes, logs any cash collected, and checks out. Missed shifts are flagged automatically.
6. A caregiver can request a **handover**; an admin reassigns.
7. When the last shift ends the booking is finalised and earnings start clearing.

## 5. Caregiver earnings and ledger

- Gross per session = adjusted price/day × share, where the share is 60 % for the primary and 40 % for the assistant when one exists (100 % without), plus caregiver-performed add-ons for the primary.
- **10 % platform commission** is deducted.
- Earnings **clear after 3 days**; the **minimum withdrawal is ৳500**; admin processes withdrawals.
- **Cash collected** from a customer is owed to the platform. It is settled by deduction from earnings or by direct payment. The cash safety limit is ৳10,000.

## 6. Admin portal

Dashboard with queue badges, bookings (confirm/reject/assign/handover), payments (verify cash), caregivers (activate/deactivate, review applications and KYC), customer messages, and settings.

## 7. Architecture

- Angular 22, standalone components, zoneless, signals, lazy-loaded routes, functional role guards.
- **`core/domain/`** holds the pure business engine (`catalog.ts`, `engine.ts`, `seed.ts`). Every rule is a function over a plain `Db` that throws `DomainError` on violations.
- **`core/store.ts`** clones the Db, runs an engine function, commits it to `localStorage` and toasts any `DomainError`.
- **Seed data** is produced by running the real engine against a simulated clock, so demo data is always consistent with the rules. Dates are relative to today.
- Tailwind via CDN (one merged config in `src/index.html`); Font Awesome and Material Symbols; all images are local in `public/assets/img`.

## 8. Resolved inconsistencies from the prototype

| # | Issue | Resolution |
|---|---|---|
| 1 | Price multiplier base 8 h vs 24 h | One base: 24 h (`BASE_HOURS_PER_DAY`). |
| 2 | Allowed days per tier, 15-day follow-up minimum | Enforced in the wizard and in the engine. |
| 3 | Same booking shown with different package/patient/address | Every view reads the single booking record. |
| 4 | Payment counters and next due date | Derived from installments. |
| 5 | "Most Popular" on Basic | Moved to Standard. |
| 6 | Physiotherapy "coming soon" yet billed; cleaning service | Removed from catalogue and billing. |
| 7 | Caregiver booking math | Computed by the engine from the rules in section 5. |
| 8 | Nanny prices vs generic packages | Nanny has its own price list. |
| 9 | Mixed years, Hossain/Hussain, traction numbers | Relative dates, one spelling, numbers derived from data. |
| 10 | Billing timeline mixing methods; amounts not summing | Timeline built from real payments; amounts sum to the total. |

## 9. Testing

```bash
npm run test:engine   # 33 business-rule checks, no browser
npm run build:dev
npm run e2e:smoke     # every route as every role: no console errors or broken images; guards redirect
npm run e2e:flow      # register → KYC → book → confirm → pay → assign → shift → cash → earnings
```

## 10. Assumptions and limits

- Auth and data are a **client-side demo**: plaintext demo passwords, state in `localStorage`. There is no backend.
- Nursing prices are a placeholder (same as caregiver).
- No real KYC, payment gateway or GPS verification. An "early check-in" setting exists to make demos easier.
- Tailwind is loaded from the CDN, so the app needs internet for styling.
