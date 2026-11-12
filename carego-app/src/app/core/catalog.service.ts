import { Injectable } from '@angular/core';
import {
  AddOn, HoursPerDay, Installment, PaymentFrequency, PriceBreakdown, ServiceCategory, ServiceCategoryId,
  ServicePackage, TotalDays,
} from './models';

/**
 * Pricing rules (carego.md §5).
 * The prototype disagreed on whether a package's per-day price covers 8 or 24 hours; the final
 * confirmation, booking details and payment schedules all use 24, so that is the base here.
 * Change BASE_HOURS_PER_DAY in one place if the business decides otherwise.
 */
export const BASE_HOURS_PER_DAY = 24;
export const SERVICE_FEE_RATE = 0.05;
export const UPFRONT_RATE = 0.3;
export const PLATFORM_COMMISSION_RATE = 0.1;

const COMMON_DAYS: TotalDays[] = [1, 7, 15, 30];
const COMMON_HOURS: HoursPerDay[] = [8, 12, 24];

const GENERIC_PACKAGES: ServicePackage[] = [
  {
    tier: 'basic', name: 'Basic Care', pricePerDay: 1000, popular: true,
    description: 'Essential care and assistance for daily living activities.',
    features: ['Personal care assistance', 'Meal preparation', 'Medication reminders', 'Companionship'],
    allowedDays: COMMON_DAYS, allowedHours: COMMON_HOURS,
  },
  {
    tier: 'standard', name: 'Standard Care', pricePerDay: 1500,
    description: 'Enhanced care with additional support and monitoring.',
    features: ['All Basic Care features', 'Vital signs monitoring', 'Light housekeeping', 'Mobility assistance'],
    allowedDays: COMMON_DAYS, allowedHours: COMMON_HOURS,
  },
  {
    tier: 'premium', name: 'Premium Care', pricePerDay: 2000,
    description: 'Comprehensive care with specialized attention and support.',
    features: ['All Standard Care features', 'Specialized care support', '24/7 care availability', 'Care plan management'],
    allowedDays: COMMON_DAYS, allowedHours: COMMON_HOURS,
  },
];

const CATEGORIES: ServiceCategory[] = [
  { id: 'caregiver', name: 'Home Caregiver', tagline: 'Trained caregivers for daily assistance and personal care.', packages: GENERIC_PACKAGES },
  { id: 'nursing', name: 'Home Nursing', tagline: 'Professional nursing care at the comfort of home.', packages: GENERIC_PACKAGES },
  {
    id: 'nanny', name: 'Nanny Service', tagline: 'Trusted childcare and daily baby care.',
    packages: [
      { ...GENERIC_PACKAGES[0], pricePerDay: 1200, description: 'One trained nanny for personal care, feeding and hygiene.' },
      { ...GENERIC_PACKAGES[1], pricePerDay: 1500, description: 'Adds creative, educational and learning activities.' },
      { ...GENERIC_PACKAGES[2], pricePerDay: 1900, description: 'Full engagement programme for child wellbeing.' },
    ],
  },
];

const ADD_ONS: AddOn[] = [
  { id: 'doctor-followup', name: 'MBBS Doctor Follow-Up', provider: 'Doctor', pricePerDay: 500, description: 'On-call doctor visits and tele-consultations at home.' },
  { id: 'ng-tube', name: 'NG Tube Insertion', provider: 'Doctor', pricePerDay: 500 },
  { id: 'catheter', name: 'Urinary Catheter Insertion', provider: 'Doctor', pricePerDay: 500 },
  { id: 'iv-cannula', name: 'IV Cannula Care (Insertion + Care)', provider: 'Nurse', pricePerDay: 500 },
  { id: 'injection', name: "Injection (IM / IV / SC) & IV Saline Infusion - As per doctor's advice", provider: 'Nurse', pricePerDay: 500 },
  { id: 'vitals', name: 'RBS / BP / Pulse, Oxygen saturation and Vitals Monitoring', provider: 'Nurse', pricePerDay: 500 },
  { id: 'nebulization', name: 'Nebulization', provider: 'Nurse', pricePerDay: 500 },
  { id: 'oxygen', name: 'Oxygen Inhalation', provider: 'Nurse', pricePerDay: 500 },
  { id: 'report-collection', name: 'Report Collection', provider: 'Caregiver', pricePerDay: 500 },
  { id: 'sample-collection', name: 'Sample Collection', provider: 'Caregiver', pricePerDay: 500 },
  { id: 'in-hospital', name: 'In-Hospital Care (Basic / Standard / Premium)', provider: 'Caregiver', pricePerDay: 500 },
];

export const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly categories = CATEGORIES;
  readonly addOns = ADD_ONS;
  readonly dayOptions = COMMON_DAYS;
  readonly hourOptions = COMMON_HOURS;
  readonly startTimes = ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'];

  category(id: ServiceCategoryId): ServiceCategory {
    return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
  }

  addOnsBy(provider: AddOn['provider']): AddOn[] {
    return ADD_ONS.filter((a) => a.provider === provider);
  }

  /** Pricing formula: adjusted/day = base × hours ÷ BASE_HOURS; + add-ons/day; × days; + 5% fee; 30% upfront. */
  price(pkg: ServicePackage | null, hoursPerDay: number, totalDays: number, addOnsPerDay: number): PriceBreakdown {
    const basePricePerDay = pkg?.pricePerDay ?? 0;
    const multiplier = hoursPerDay / BASE_HOURS_PER_DAY;
    const adjustedPricePerDay = round2(basePricePerDay * multiplier);
    const serviceSubtotal = round2(adjustedPricePerDay * totalDays);
    const addOnsTotal = round2(addOnsPerDay * totalDays);
    const subtotal = round2(serviceSubtotal + addOnsTotal);
    const serviceFee = round2(subtotal * SERVICE_FEE_RATE);
    const total = round2(subtotal + serviceFee);
    const upfront = round2(total * UPFRONT_RATE);
    return {
      basePricePerDay, baseHours: BASE_HOURS_PER_DAY, hoursPerDay, multiplier, adjustedPricePerDay, totalDays,
      serviceSubtotal, addOnsPerDay, addOnsTotal, subtotal, serviceFeeRate: SERVICE_FEE_RATE, serviceFee, total,
      upfrontRate: UPFRONT_RATE, upfront, remaining: round2(total - upfront),
    };
  }

  /** Number of instalments the remaining 70% is split into for a plan. */
  installmentCount(frequency: PaymentFrequency, totalDays: number): number {
    if (frequency === 'daily') return Math.max(1, totalDays);
    if (frequency === 'weekly') return Math.max(1, Math.floor(totalDays / 7));
    return 1;
  }

  /** Full payment schedule: upfront deposit (due after admin confirmation) + remaining instalments. */
  schedule(breakdown: PriceBreakdown, frequency: PaymentFrequency, startDate: Date | null): Installment[] {
    const count = this.installmentCount(frequency, breakdown.totalDays);
    const per = round2(breakdown.remaining / count);
    const perPct = round2((100 * (1 - UPFRONT_RATE)) / count);
    const rows: Installment[] = [{
      label: '30% Upfront Down-Payment Deposit', dueDate: null, dueLabel: 'Due Today (After Confirmation)',
      amount: breakdown.upfront, percent: 30, status: 'due',
    }];
    const stepDays = frequency === 'weekly' ? 7 : 1;
    for (let i = 0; i < count; i++) {
      const due = startDate ? addDays(startDate, 1 + i * stepDays) : null;
      const label = frequency === 'together' ? 'Remaining Balance – Full' :
        frequency === 'weekly' ? `Remaining Balance – Week ${i + 1}` : `Remaining Balance – Day ${i + 1}`;
      rows.push({ label, dueDate: due, dueLabel: due ? `Due on ${fmtDate(due)}` : 'Due after confirmation', amount: per, percent: perPct, status: 'upcoming' });
    }
    return rows;
  }
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtLongDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
