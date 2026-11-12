/** Domain model for CareGo+ (see carego.md for the business rules these encode). */

export type ServiceCategoryId = 'caregiver' | 'nursing' | 'nanny';
export type PackageTier = 'basic' | 'standard' | 'premium';
export type HoursPerDay = 8 | 12 | 24;
export type TotalDays = 1 | 7 | 15 | 30;
export type PaymentFrequency = 'together' | 'weekly' | 'daily';
export type PatientMobility = 'Mobile' | 'Bedridden';

export type BookingStatus = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'paid' | 'partial' | 'due' | 'upcoming' | 'pending' | 'scheduled' | 'failed';

export interface ServiceCategory {
  id: ServiceCategoryId;
  name: string;
  tagline: string;
  packages: ServicePackage[];
}

export interface ServicePackage {
  tier: PackageTier;
  name: string;
  description: string;
  /** Price in BDT for one day of service at BASE_HOURS_PER_DAY coverage. */
  pricePerDay: number;
  features: string[];
  popular?: boolean;
  allowedDays: TotalDays[];
  allowedHours: HoursPerDay[];
}

export type AddOnProvider = 'Doctor' | 'Nurse' | 'Caregiver';

export interface AddOn {
  id: string;
  name: string;
  provider: AddOnProvider;
  /** BDT per day. */
  pricePerDay: number;
  description?: string;
}

export interface PatientInfo {
  fullName: string;
  age: number | null;
  gender: '' | 'Male' | 'Female' | 'Other';
  weightKg: number | null;
  address: string;
  medicalCondition: string;
  mobility: PatientMobility;
  attendantName: string;
  attendantRelation: string;
  attendantMobile: string;
  secondaryName: string;
  secondaryRelation: string;
  secondaryMobile: string;
}

export interface Installment {
  label: string;
  dueDate: Date | null;
  dueLabel: string;
  amount: number;
  percent: number;
  status: PaymentStatus;
}

export interface PriceBreakdown {
  basePricePerDay: number;
  baseHours: number;
  hoursPerDay: number;
  multiplier: number;
  adjustedPricePerDay: number;
  totalDays: number;
  serviceSubtotal: number;
  addOnsPerDay: number;
  addOnsTotal: number;
  subtotal: number;
  serviceFeeRate: number;
  serviceFee: number;
  total: number;
  upfrontRate: number;
  upfront: number;
  remaining: number;
}

export interface Booking {
  id: string;
  patientId?: string;
  category: ServiceCategoryId;
  categoryName: string;
  packageName: string;
  status: BookingStatus;
  statusNote: string;
  bookedOn: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  totalDays: number;
  hoursPerDay: number;
  amount: number;
  paid: number;
  paidNote?: string;
  installments: Installment[];
  sessionsCompleted: number;
  paymentsReceived: number;
  paymentsTotal: number;
  frequency: PaymentFrequency;
  addOns: { name: string; provider: AddOnProvider; pricePerDay: number }[];
  breakdown: PriceBreakdown;
  patient: { name: string; mobile: string; age: number; gender: string; weightKg: number; address: string };
}

export interface Patient {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  age: number;
  status: 'Active' | 'Inactive';
  addedOn: string;
  mobile: string;
  bookingLabel: 'Active Booking' | 'Upcoming Booking' | 'Last Booking';
  bookingService: string;
  bookingPackage?: string;
  bookingId: string;
  nextServiceLabel: 'Next Service' | 'Completed on';
  nextService: string;
}

export interface PaymentMethod {
  id: string;
  type: 'bKash' | 'Nagad' | 'Visa Card' | 'Mastercard';
  masked: string;
}

export interface ActiveService {
  id: string;
  title: string;
  subject: string;
  nextPayment: string;
  amount: number;
  status: 'Paid' | 'Upcoming' | 'Pending' | 'Completed';
  period: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  service: string;
  pkg: string;
  method: string;
  amount: number;
  status: 'Success' | 'Pending Verification' | 'Failed / Disputed';
}

export interface CaregiverShift {
  bookingId: string;
  packageId: string;
  service: string;
  patient: string;
  age: number;
  diagnosis: string;
  address: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  status: 'Active' | 'Upcoming' | 'Completed';
  checkedInAt?: string;
  coPresentWith?: string;
  handoverTo?: string;
}

export interface EarningRow {
  date: string;
  service: string;
  bookingId: string;
  duration: string;
  gross: number;
  fee: number;
  net: number;
  status: 'Completed' | 'Withdrawn' | 'Pending';
}

export interface LedgerEntry {
  date: string;
  time: string;
  description: string;
  ref: string;
  flow: 'Cash Collected' | 'Withdrawal' | 'Internal Flow' | 'Digital Credit';
  debit: number | null;
  credit: number | null;
  balance: number;
  status: 'Reconciled' | 'Pending Sync' | 'Settled';
}
