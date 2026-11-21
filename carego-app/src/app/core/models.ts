/**
 * Domain model for CareGo+ (see carego.md for the business rules these encode).
 * Everything persisted is plain JSON: dates are ISO strings (YYYY-MM-DD for days, full ISO for instants).
 */

export type Role = 'user' | 'caregiver' | 'admin';
export type ServiceCategoryId = 'caregiver' | 'nursing' | 'nanny';
export type PackageTier = 'basic' | 'standard' | 'premium';
export type HoursPerDay = 8 | 12 | 24;
export type TotalDays = 1 | 7 | 15 | 30;
export type PaymentFrequency = 'together' | 'weekly' | 'daily';
export type StaffKind = 'Caregiver' | 'Nurse' | 'Nanny';
export type AddOnProvider = 'Doctor' | 'Nurse' | 'Caregiver';
export type PayMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Card' | 'Cash to Staff';

export type BookingStatus = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
export type InstallmentState = 'paid' | 'pending-verification' | 'due' | 'overdue' | 'upcoming';

// ───────────────────────── Accounts ─────────────────────────

export interface Kyc {
  status: 'unverified' | 'verified';
  nid?: string;
  selfieName?: string;
  verifiedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  /** Email or phone used to sign in. */
  identifier: string;
  /** Demo-only: a real backend must store a salted hash, never the password. */
  password: string;
  roles: Role[];
  caregiverId?: string;
  kyc: Kyc;
  photo?: string;
  createdAt: string;
}

export interface Caregiver {
  id: string;
  name: string;
  kind: StaffKind;
  photo?: string;
  age: number;
  gender: 'Male' | 'Female';
  languages: string[];
  nationality: string;
  experienceYears: number;
  rating: number;
  reviews: number;
  verified: boolean;
  phone: string;
  active: boolean;
}

// ───────────────────────── Catalogue ─────────────────────────

export interface ServicePackage {
  tier: PackageTier;
  name: string;
  description: string;
  /** BDT for one day of service at BASE_HOURS_PER_DAY coverage. */
  pricePerDay: number;
  features: string[];
  popular?: boolean;
  allowedDays: TotalDays[];
  allowedHours: HoursPerDay[];
  /** Standard and Premium pair a primary with an assistant. */
  hasAssistant: boolean;
}

export interface ServiceCategory {
  id: ServiceCategoryId;
  name: string;
  tagline: string;
  icon: string;
  /** Kind of staff that serves as the primary (RN for nursing, nanny for nanny...). */
  primaryKind: StaffKind;
  packages: ServicePackage[];
}

export interface AddOn {
  id: string;
  name: string;
  provider: AddOnProvider;
  /** BDT per day. */
  pricePerDay: number;
  description?: string;
  /** Minimum booking length in days (e.g. doctor follow-up needs 15). */
  minDays?: number;
  needsPrescription?: boolean;
}

// ───────────────────────── Patients ─────────────────────────

export interface Contact {
  name: string;
  relation: string;
  mobile: string;
}

export type DocumentCategory = 'Discharge Summary' | 'Prescriptions' | 'Investigation Reports' | 'ID Proofs' | 'Others';

export interface PatientDocument {
  id: string;
  category: DocumentCategory;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
}

export interface PatientNote {
  id: string;
  title: string;
  text: string;
  by: string;
  at: string;
}

export interface Patient {
  id: string;
  ownerId: string;
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  age: number;
  weightKg: number | null;
  bloodGroup: string;
  nidNumber: string;
  mobile: string;
  altMobile: string;
  address: string;
  photo?: string;
  addedOn: string;
  mobility: 'Mobile' | 'Bedridden';
  diagnosis: string;
  conditions: string[];
  infection: { hepatitis: boolean; tb: boolean; covid: boolean; contagious: boolean };
  allergies: string;
  functional: { mobility: string; toilet: string; feeding: string; mental: string; behavioral: string; notes: string };
  primaryContact: Contact;
  secondaryContact: Contact | null;
  treatingDoctor: string;
  hospital: string;
  documents: PatientDocument[];
  notes: PatientNote[];
}

// ───────────────────────── Bookings ─────────────────────────

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

export interface Installment {
  seq: number;
  label: string;
  /** null for the deposit: it falls due when the admin confirms the booking. */
  dueDate: string | null;
  amount: number;
  percent: number;
  /** Money that has been verified as received. */
  paidAmount: number;
  /** Cash handed to staff that is waiting for admin verification. */
  pendingAmount: number;
}

export type TimelineKind =
  | 'placed' | 'confirmed' | 'payment' | 'cash' | 'assigned' | 'started' | 'session' | 'handover' | 'completed' | 'cancelled' | 'info';

export interface TimelineEvent {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  text: string;
  amount?: number;
}

export interface AssignedCaregiver {
  caregiverId: string;
  role: 'Primary' | 'Assistant';
}

export interface Booking {
  id: string;
  ownerId: string;
  patientId: string;
  category: ServiceCategoryId;
  categoryName: string;
  tier: PackageTier;
  packageName: string;
  status: BookingStatus;
  bookedAt: string;
  confirmedAt?: string;
  /** Deposit must be paid before this instant or the booking lapses. */
  depositDueBy?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  startDate: string;
  startTime: string;
  totalDays: number;
  hoursPerDay: number;
  addOns: { id: string; name: string; provider: AddOnProvider; pricePerDay: number }[];
  frequency: PaymentFrequency;
  breakdown: PriceBreakdown;
  installments: Installment[];
  assigned: AssignedCaregiver[];
  consentAcceptedAt: string;
  serviceAddress: string;
  instructions: string[];
  backupContact: Contact | null;
  timeline: TimelineEvent[];
}

export interface Attendance {
  caregiverId: string;
  role: 'Primary' | 'Assistant';
  checkInAt?: string;
  checkOutAt?: string;
  geo?: { lat: number; lng: number };
}

export interface SessionNote {
  id: string;
  text: string;
  at: string;
  by: string;
}

export interface HandoverRequest {
  requestedBy: string;
  to: string;
  requestedAt: string;
  status: 'requested' | 'approved' | 'declined';
}

export interface Session {
  id: string;
  bookingId: string;
  index: number;
  date: string;
  startTime: string;
  hours: number;
  status: 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';
  attendance: Attendance[];
  cashLogged: number;
  notes: SessionNote[];
  vitals?: { bp: string; pulse: number; spo2: number; at: string };
  handover?: HandoverRequest;
}

// ───────────────────────── Payments & money ─────────────────────────

export interface Payment {
  id: string;
  bookingId: string;
  at: string;
  method: PayMethod;
  amount: number;
  status: 'success' | 'pending-verification' | 'failed';
  reference?: string;
  allocations: { seq: number; amount: number }[];
  collectedBy?: string;
  note?: string;
}

export type LedgerKind = 'earning' | 'commission' | 'cash-collected' | 'settle-deduct' | 'settle-direct' | 'withdrawal';
export type LedgerStatus = 'Reconciled' | 'Pending Sync' | 'Settled' | 'Voided';

export interface LedgerEntry {
  id: string;
  caregiverId: string;
  at: string;
  kind: LedgerKind;
  description: string;
  ref: string;
  amount: number;
  status: LedgerStatus;
  /** Earnings only count as withdrawable once this instant has passed. */
  clearAt?: string;
  bookingId?: string;
  sessionId?: string;
  paymentId?: string;
  method?: string;
  hours?: number;
  gross?: number;
  fee?: number;
}

// ───────────────────────── Misc records ─────────────────────────

export interface SavedMethod {
  id: string;
  ownerId: string;
  type: 'bKash' | 'Nagad' | 'Visa Card' | 'Mastercard';
  masked: string;
}

export interface CaregiverApplication {
  id: string;
  name: string;
  phone: string;
  email: string;
  kind: StaffKind;
  experienceYears: number;
  nid: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  at: string;
  handled: boolean;
}

// ───────────────────────── Doctor consultation ─────────────────────────

export type ConsultMode = 'video' | 'chamber';
export type ConsultKind = 'scheduled' | 'instant' | 'follow-up';
export type ConsultStatus = 'upcoming' | 'completed' | 'cancelled' | 'missed';

export interface Specialty {
  id: string;
  name: string;
  /** Short line under the name, e.g. "Child health care". */
  blurb: string;
  icon: string;
}

export interface DoctorSchedule {
  /** Weekdays (0 = Sunday) the slots below are offered. */
  days: number[];
  /** 24h "HH:MM". */
  start: string;
  end: string;
  slotMins: number;
}

export interface Doctor {
  id: string;
  name: string;
  /** Academic title shown before the name, e.g. "Asst. Prof.". */
  title?: string;
  photo?: string;
  gender: 'Male' | 'Female';
  degrees: string[];
  specialtyId: string;
  /** What the card says the doctor is, e.g. "Thoracic Surgeon". */
  designation: string;
  workplace: string;
  /** One-line professional summary shown under the name on the profile. */
  headline?: string;
  experienceYears: number;
  rating: number;
  reviews: number;
  visits: number;
  /** BMDC registration number, shown when known. */
  bmdc?: string;
  languages: string[];
  about: string;
  /** BDT per consultation; `listFee` is the struck-through price when on offer. */
  fee: number;
  listFee?: number;
  /** A follow-up within `followUpDays` of a completed consultation costs `followUpFee` (0 = free). */
  followUpFee: number;
  followUpDays: number;
  modes: ConsultMode[];
  /** Online now: can be seen instantly over video. */
  online: boolean;
  /** Spotlighted on the home and Doctor Consultation pages and listed first. */
  featured?: boolean;
  video?: DoctorSchedule;
  chamber?: DoctorSchedule & { name: string; address: string };
}

export interface ConsultPatient {
  /** A saved patient, or null when the account holder consults for themselves. */
  id: string | null;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
}

export interface Medicine {
  name: string;
  dose: string;
  duration: string;
  note?: string;
}

export interface Prescription {
  at: string;
  complaints: string;
  diagnosis: string;
  medicines: Medicine[];
  tests: string[];
  advice: string[];
  followUpBy: string;
}

export interface Consultation {
  id: string;
  ownerId: string;
  doctorId: string;
  patient: ConsultPatient;
  mode: ConsultMode;
  kind: ConsultKind;
  date: string;
  /** "08:00 PM" style, like booking start times. */
  time: string;
  symptoms: string;
  status: ConsultStatus;
  fee: number;
  payment: { method: PayMethod; reference: string; at: string } | null;
  bookedAt: string;
  /** When the patient last joined the video room. */
  joinedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  refund?: { amount: number; method: string; at: string };
  followUpOf?: string;
  prescription?: Prescription;
}

export interface Settings {
  /** Lets caregivers check in before the scheduled day so the whole flow can be demoed. */
  demoEarlyCheckIn: boolean;
  /** Maximum cash a caregiver may hold for the platform before they must settle. */
  cashLimit: number;
}

export interface Db {
  version: number;
  accounts: Account[];
  caregivers: Caregiver[];
  patients: Patient[];
  bookings: Booking[];
  sessions: Session[];
  payments: Payment[];
  ledger: LedgerEntry[];
  savedMethods: SavedMethod[];
  applications: CaregiverApplication[];
  messages: ContactMessage[];
  consultations: Consultation[];
  settings: Settings;
  counters: Record<string, number>;
}
