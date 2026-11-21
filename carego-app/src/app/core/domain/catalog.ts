import {
  AddOn, HoursPerDay, Installment, PackageTier, PaymentFrequency, PriceBreakdown, ServiceCategory,
  ServiceCategoryId, ServicePackage, TotalDays,
} from '../models';

/**
 * Pricing rules (carego.md §5).
 *
 * The prototype disagreed on whether a package's per-day price covers 8 or 24 hours. The decision taken here:
 * the listed price is for a FULL 24-hour day, and shorter shifts scale down proportionally
 * (8h = 1/3, 12h = 1/2). Change BASE_HOURS_PER_DAY in this one place to revisit it.
 */
export const BASE_HOURS_PER_DAY = 24;
export const SERVICE_FEE_RATE = 0.05;
export const UPFRONT_RATE = 0.3;
/** CareGo+ commission taken from a caregiver's gross earning. */
export const PLATFORM_COMMISSION_RATE = 0.1;
/** Hours a customer has to pay the deposit after the admin confirms. */
export const DEPOSIT_WINDOW_HOURS = 24;
/** Business days an earning stays "pending clearance" before it can be withdrawn. */
export const CLEARANCE_DAYS = 3;
export const MIN_WITHDRAWAL = 500;
/** Share of a session's service value paid to each role when a package has an assistant. */
export const PRIMARY_SHARE_WITH_ASSISTANT = 0.6;

/** Card-number checksum; simulated card payments reject numbers that fail it. */
export const luhn = (num: string): boolean => {
  const d = num.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(d)) return false;
  let sum = 0;
  [...d].reverse().forEach((ch, i) => {
    let n = Number(ch);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  });
  return sum % 10 === 0;
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const ALL_HOURS: HoursPerDay[] = [8, 12, 24];

function pkg(
  tier: PackageTier, name: string, pricePerDay: number, description: string, features: string[],
  allowedDays: TotalDays[], allowedHours: HoursPerDay[], hasAssistant: boolean, popular = false,
): ServicePackage {
  return { tier, name, pricePerDay, description, features, allowedDays, allowedHours, hasAssistant, popular };
}

const CAREGIVER_FEATURES = {
  basic: ['Personal care assistance', 'Meal preparation', 'Medication reminders', 'Companionship'],
  standard: ['All Basic Care features', 'Vital signs monitoring', 'Light housekeeping', 'Mobility assistance'],
  premium: ['All Standard Care features', 'Specialized care support', '24/7 care availability', 'Care plan management'],
};

const CATEGORIES: ServiceCategory[] = [
  {
    id: 'caregiver', name: 'Home Caregiver', icon: 'fa-hand-holding-heart', primaryKind: 'Caregiver',
    tagline: 'Trained caregivers for daily assistance and personal care.',
    packages: [
      pkg('basic', 'Basic Care', 1000, 'Essential care and assistance for daily living activities.', CAREGIVER_FEATURES.basic, [1, 7, 30], ALL_HOURS, false),
      pkg('standard', 'Standard Care', 1500, 'Enhanced care with additional support and monitoring.', CAREGIVER_FEATURES.standard, [7, 15, 30], ALL_HOURS, true, true),
      pkg('premium', 'Premium Care', 2000, 'Comprehensive care with specialized attention and support.', CAREGIVER_FEATURES.premium, [7, 15, 30], [24], true),
    ],
  },
  {
    id: 'nursing', name: 'Home Nursing', icon: 'fa-user-nurse', primaryKind: 'Nurse',
    tagline: 'Professional nursing care at the comfort of home.',
    // Prices for nursing were never specified separately in the prototype; they follow the generic package ladder.
    packages: [
      pkg('basic', 'Basic Care', 1000, 'One licensed RN for vitals, injections and medication management.', ['Vitals tracking (RBS, BP, pulse, SpO₂)', 'IV cannula insertion & care', 'Injections & saline per prescription', 'Medication management'], [1, 7, 30], ALL_HOURS, false),
      pkg('standard', 'Standard Care', 1500, 'RN plus a caregiver assistant with wound, catheter and tube care.', ['All Basic Care features', 'Nebulization & oxygen support', 'Wound dressing & catheter care', 'Personal care & bath support'], [7, 15, 30], ALL_HOURS, true, true),
      pkg('premium', 'Premium Care', 2000, 'Live-in RN cover with critical patient support and monthly reporting.', ['All Standard Care features', 'NG tube feeding & care', 'Critical patient support', 'Monthly digital health report'], [7, 15, 30], [24], true),
    ],
  },
  {
    id: 'nanny', name: 'Nanny Service', icon: 'fa-baby', primaryKind: 'Nanny',
    tagline: 'Trusted childcare and daily baby care.',
    packages: [
      pkg('basic', 'Basic Care', 1200, 'One trained nanny for personal care, feeding and hygiene.', ['Personal care', 'Light meal preparation & feeding', 'Bottle feeding support', 'Hygiene maintenance'], [1, 7, 15, 30], ALL_HOURS, false),
      pkg('standard', 'Standard Care', 1500, 'Adds creative, educational and learning activities.', ['All Basic Care features', 'Educational games & learning', 'Drawing & craft activities', "Tidy up children's rooms"], [1, 7, 15, 30], ALL_HOURS, false, true),
      pkg('premium', 'Premium Care', 1900, 'Full engagement programme for child wellbeing.', ['All Standard Care features', 'Supportive wellbeing activities', 'Recreational age-appropriate activities', 'Extended availability'], [1, 7, 15, 30], ALL_HOURS, false),
    ],
  },
];

const ADD_ONS: AddOn[] = [
  { id: 'doctor-followup', name: 'MBBS Doctor Follow-Up', provider: 'Doctor', pricePerDay: 500, minDays: 15, description: 'On-call doctor visits and tele-consultations at home.' },
  { id: 'ng-tube', name: 'NG Tube Insertion', provider: 'Doctor', pricePerDay: 500, needsPrescription: true },
  { id: 'catheter', name: 'Urinary Catheter Insertion', provider: 'Doctor', pricePerDay: 500, needsPrescription: true },
  { id: 'iv-cannula', name: 'IV Cannula Care (Insertion + Care)', provider: 'Nurse', pricePerDay: 500 },
  { id: 'injection', name: "Injection (IM / IV / SC) & IV Saline Infusion - As per doctor's advice", provider: 'Nurse', pricePerDay: 500, needsPrescription: true },
  { id: 'vitals', name: 'RBS / BP / Pulse, Oxygen saturation and Vitals Monitoring', provider: 'Nurse', pricePerDay: 500 },
  { id: 'nebulization', name: 'Nebulization', provider: 'Nurse', pricePerDay: 500 },
  { id: 'oxygen', name: 'Oxygen Inhalation', provider: 'Nurse', pricePerDay: 500 },
  { id: 'report-collection', name: 'Report Collection', provider: 'Caregiver', pricePerDay: 500 },
  { id: 'sample-collection', name: 'Sample Collection', provider: 'Caregiver', pricePerDay: 500 },
  { id: 'in-hospital', name: 'In-Hospital Care (Basic / Standard / Premium)', provider: 'Caregiver', pricePerDay: 500 },
];

export const START_TIMES = ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'];

export const categories = (): ServiceCategory[] => CATEGORIES;
export const addOns = (): AddOn[] => ADD_ONS;
export const category = (id: ServiceCategoryId): ServiceCategory => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
export const packageOf = (cat: ServiceCategoryId, tier: PackageTier): ServicePackage | undefined =>
  category(cat).packages.find((p) => p.tier === tier);
export const addOnById = (id: string): AddOn | undefined => ADD_ONS.find((a) => a.id === id);

/** Why a given add-on can't be chosen for this booking length, or null when it's allowed. */
export function addOnBlockedReason(a: AddOn, totalDays: number | null): string | null {
  if (a.minDays && (totalDays ?? 0) < a.minDays) return `Requires a booking of at least ${a.minDays} days`;
  return null;
}

/** Adjusted daily rate for a shift length. */
export function pricePerDay(basePricePerDay: number, hoursPerDay: number): number {
  return round2((basePricePerDay * hoursPerDay) / BASE_HOURS_PER_DAY);
}

/** Pricing formula: adjusted/day = base × hours ÷ BASE_HOURS; + add-ons/day; × days; + 5% fee; 30% upfront. */
export function price(basePricePerDay: number, hoursPerDay: number, totalDays: number, addOnsPerDay: number): PriceBreakdown {
  const multiplier = hoursPerDay / BASE_HOURS_PER_DAY;
  const adjustedPricePerDay = pricePerDay(basePricePerDay, hoursPerDay);
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

/** Which payment frequencies make sense for a booking length. */
export function frequencyAllowed(frequency: PaymentFrequency, totalDays: number): boolean {
  if (frequency === 'together') return true;
  if (frequency === 'weekly') return totalDays >= 14;
  return totalDays >= 2;
}

export function installmentCount(frequency: PaymentFrequency, totalDays: number): number {
  if (frequency === 'daily') return Math.max(1, totalDays);
  if (frequency === 'weekly') return Math.max(1, Math.floor(totalDays / 7));
  return 1;
}

export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDay = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, n: number): string => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

/** Deposit (due on confirmation) + the remaining 70% split by frequency. */
export function buildInstallments(b: PriceBreakdown, frequency: PaymentFrequency, startDate: string): Installment[] {
  const count = installmentCount(frequency, b.totalDays);
  const per = round2(b.remaining / count);
  const perPct = round2((100 * (1 - UPFRONT_RATE)) / count);
  const rows: Installment[] = [{
    seq: 0, label: '30% Upfront Down-Payment Deposit', dueDate: null, amount: b.upfront, percent: 30, paidAmount: 0, pendingAmount: 0,
  }];
  const step = frequency === 'weekly' ? 7 : 1;
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    // The last instalment absorbs any rounding remainder so the schedule always sums to the total.
    const amount = i === count - 1 ? round2(b.remaining - allocated) : per;
    allocated = round2(allocated + amount);
    rows.push({
      seq: i + 1,
      label: frequency === 'together' ? 'Remaining Balance – Full' : frequency === 'weekly' ? `Remaining Balance – Week ${i + 1}` : `Remaining Balance – Day ${i + 1}`,
      dueDate: addDays(startDate, 1 + i * step), amount, percent: perPct, paidAmount: 0, pendingAmount: 0,
    });
  }
  return rows;
}

export const fmtDay = (iso: string): string =>
  parseDay(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtLongDay = (iso: string): string =>
  parseDay(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
