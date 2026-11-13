import {
  Account, AssignedCaregiver, Attendance, Booking, BookingStatus, Caregiver, CaregiverApplication, Contact, Db,
  DocumentCategory, Installment, InstallmentState, LedgerEntry, Patient, PatientDocument, Payment, PayMethod,
  PaymentFrequency, PackageTier, ServiceCategoryId, Session, StaffKind, TimelineEvent, TimelineKind, HoursPerDay,
  TotalDays, ContactMessage,
} from '../models';
import {
  CLEARANCE_DAYS, DEPOSIT_WINDOW_HOURS, MIN_WITHDRAWAL, PLATFORM_COMMISSION_RATE, PRIMARY_SHARE_WITH_ASSISTANT,
  START_TIMES, addDays, addOnById, buildInstallments, category, frequencyAllowed, addOnBlockedReason, isoDay,
  packageOf, parseDay, price, round2,
} from './catalog';

/** A rule of the business was violated; the message is safe to show to the user. */
export class DomainError extends Error {}

function fail(message: string): never {
  throw new DomainError(message);
}

const EPS = 0.005;

// ───────────────────────── time helpers ─────────────────────────

export const nowIso = (d: Date): string => d.toISOString();

/** Instant for a given local day and "HH:MM AM" label (or 24h "HH:MM"). */
export function atTime(day: string, label: string): Date {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(label.trim());
  if (!m) return parseDay(day);
  let h = Number(m[1]) % 12;
  if ((m[3] ?? '').toUpperCase() === 'PM') h += 12;
  if (!m[3]) h = Number(m[1]);
  const d = parseDay(day);
  d.setHours(h, Number(m[2]), 0, 0);
  return d;
}

export const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export const dateTimeLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${clock(iso)}`;
};

// ───────────────────────── ids ─────────────────────────

function next(db: Db, key: string, start = 0): number {
  db.counters[key] = (db.counters[key] ?? start) + 1;
  return db.counters[key];
}

const pad = (n: number, w: number): string => String(n).padStart(w, '0');

function yymmdd(d: Date): string {
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;
}

// ───────────────────────── lookups ─────────────────────────

export const findBooking = (db: Db, id: string): Booking | undefined => db.bookings.find((b) => b.id === id);
export const findPatient = (db: Db, id: string): Patient | undefined => db.patients.find((p) => p.id === id);
export const findCaregiver = (db: Db, id: string): Caregiver | undefined => db.caregivers.find((c) => c.id === id);
export const findAccount = (db: Db, id: string): Account | undefined => db.accounts.find((a) => a.id === id);
export const findSession = (db: Db, id: string): Session | undefined => db.sessions.find((s) => s.id === id);

function mustBooking(db: Db, id: string): Booking {
  return findBooking(db, id) ?? fail('Booking not found.');
}
function mustSession(db: Db, id: string): Session {
  return findSession(db, id) ?? fail('Session not found.');
}

export const sessionsOf = (db: Db, bookingId: string): Session[] =>
  db.sessions.filter((s) => s.bookingId === bookingId).sort((a, b) => a.index - b.index);

// ───────────────────────── derived money / status ─────────────────────────

export const bookingPaid = (b: Booking): number => round2(b.installments.reduce((s, i) => s + i.paidAmount, 0));
export const bookingPendingCash = (b: Booking): number => round2(b.installments.reduce((s, i) => s + i.pendingAmount, 0));
export const bookingDue = (b: Booking): number => round2(b.breakdown.total - bookingPaid(b));
/** Amount that can still be paid (excludes cash already awaiting verification). */
export const bookingPayable = (b: Booking): number => round2(b.breakdown.total - bookingPaid(b) - bookingPendingCash(b));
export const depositPaid = (b: Booking): boolean => b.installments[0].paidAmount >= b.installments[0].amount - EPS;
export const isPayable = (b: Booking): boolean => b.status === 'confirmed' || b.status === 'in-progress' || b.status === 'completed';

const covered = (i: Installment): boolean => i.paidAmount + i.pendingAmount >= i.amount - EPS;

export const nextInstallment = (b: Booking): Installment | undefined => b.installments.find((i) => !covered(i));

export function installmentState(b: Booking, i: Installment, today: string): InstallmentState {
  if (i.paidAmount >= i.amount - EPS) return 'paid';
  if (covered(i)) return 'pending-verification';
  if (b.status === 'cancelled') return 'upcoming';
  if (i.dueDate && i.dueDate < today && isPayable(b)) return 'overdue';
  if (isPayable(b) && nextInstallment(b)?.seq === i.seq) return 'due';
  return 'upcoming';
}

export const paymentsReceived = (b: Booking): number => b.installments.filter((i) => i.paidAmount >= i.amount - EPS).length;

export function sessionsCompleted(db: Db, bookingId: string): number {
  return db.sessions.filter((s) => s.bookingId === bookingId && s.status === 'completed').length;
}

export const bookingEndDate = (b: Booking): string => addDays(b.startDate, b.totalDays - 1);

export function patientStatus(db: Db, patientId: string): 'Active' | 'Inactive' {
  return db.bookings.some((b) => b.patientId === patientId && ['pending', 'confirmed', 'in-progress'].includes(b.status))
    ? 'Active' : 'Inactive';
}

export function caregiverName(db: Db, id: string): string {
  return findCaregiver(db, id)?.name ?? 'Unassigned';
}

// ───────────────────────── timeline ─────────────────────────

function log(db: Db, b: Booking, now: Date, kind: TimelineKind, title: string, text: string, amount?: number): void {
  const ev: TimelineEvent = { id: `E${next(db, 'event')}`, at: nowIso(now), kind, title, text, amount };
  b.timeline.push(ev);
}

// ───────────────────────── KYC ─────────────────────────

/** Bangladeshi NID numbers are 10, 13 or 17 digits. */
export const isValidNid = (nid: string): boolean => /^(\d{10}|\d{13}|\d{17})$/.test(nid.replace(/\s/g, ''));

export function submitKyc(db: Db, accountId: string, nid: string, selfieName: string, now: Date): void {
  const acc = findAccount(db, accountId) ?? fail('Account not found.');
  if (!isValidNid(nid)) fail('Enter a valid National ID number (10, 13 or 17 digits).');
  if (!selfieName) fail('Please upload a selfie to complete verification.');
  acc.kyc = { status: 'verified', nid: nid.replace(/\s/g, ''), selfieName, verifiedAt: nowIso(now) };
}

// ───────────────────────── patients ─────────────────────────

export interface PatientInput {
  fullName: string;
  age: number | null;
  gender: '' | 'Male' | 'Female' | 'Other';
  weightKg: number | null;
  address: string;
  medicalCondition: string;
  mobility: 'Mobile' | 'Bedridden';
  attendantName: string;
  attendantRelation: string;
  attendantMobile: string;
  secondaryName: string;
  secondaryRelation: string;
  secondaryMobile: string;
}

export function validatePatientInput(p: PatientInput): string | null {
  if (p.fullName.trim().length < 2) return "Enter the patient's full name.";
  if (!p.age || p.age < 0 || p.age > 120) return 'Enter a valid patient age.';
  if (!p.gender) return "Select the patient's gender.";
  if (p.address.trim().length < 4) return 'Enter the current address.';
  if (p.attendantName.trim().length < 2) return "Enter the primary attendant's name.";
  if (!p.attendantRelation.trim()) return "Enter the attendant's relationship with the patient.";
  if (!isValidBdMobile(p.attendantMobile)) return 'Enter a valid mobile number for the primary attendant (e.g. 01712345678).';
  if (p.secondaryMobile.trim() && !isValidBdMobile(p.secondaryMobile)) return 'The secondary contact number is not valid.';
  return null;
}

/** Accepts 01XXXXXXXXX, 1XXXXXXXXX (after +880) and +8801XXXXXXXXX. */
export function isValidBdMobile(raw: string): boolean {
  const n = raw.replace(/[\s-]/g, '').replace(/^\+?880/, '').replace(/^0/, '');
  return /^1[3-9]\d{8}$/.test(n);
}

export function normalizeMobile(raw: string): string {
  const n = raw.replace(/[\s-]/g, '').replace(/^\+?880/, '').replace(/^0/, '');
  return `+880 ${n.slice(0, 4)}-${n.slice(4)}`;
}

export function blankPatient(id: string, ownerId: string, now: Date): Patient {
  return {
    id, ownerId, name: '', gender: 'Male', age: 0, weightKg: null, bloodGroup: '', nidNumber: '', mobile: '', altMobile: '', address: '',
    addedOn: isoDay(now), mobility: 'Mobile', diagnosis: '', conditions: [],
    infection: { hepatitis: false, tb: false, covid: false, contagious: false }, allergies: '',
    functional: { mobility: 'Independent', toilet: 'No assistance', feeding: 'Independent', mental: 'Alert', behavioral: 'None', notes: '' },
    primaryContact: { name: '', relation: '', mobile: '' }, secondaryContact: null, treatingDoctor: '', hospital: '', documents: [], notes: [],
  };
}

export function createPatient(db: Db, ownerId: string, input: PatientInput, now: Date, idOverride?: string): Patient {
  const err = validatePatientInput(input);
  if (err) fail(err);
  const p = blankPatient(idOverride ?? `PT-${1000 + next(db, 'patient', 0)}`, ownerId, now);
  p.name = input.fullName.trim();
  p.age = input.age ?? 0;
  p.gender = input.gender as Patient['gender'];
  p.weightKg = input.weightKg;
  p.address = input.address.trim();
  p.diagnosis = input.medicalCondition.trim();
  p.mobility = input.mobility;
  p.functional.mobility = input.mobility === 'Bedridden' ? 'Bedridden' : 'Needs support';
  p.primaryContact = { name: input.attendantName.trim(), relation: input.attendantRelation.trim(), mobile: normalizeMobile(input.attendantMobile) };
  p.mobile = p.primaryContact.mobile;
  p.secondaryContact = input.secondaryName.trim()
    ? { name: input.secondaryName.trim(), relation: input.secondaryRelation.trim(), mobile: input.secondaryMobile.trim() ? normalizeMobile(input.secondaryMobile) : '' }
    : null;
  db.patients.unshift(p);
  return p;
}

export function updatePatient(db: Db, patientId: string, patch: Partial<Patient>): void {
  const p = findPatient(db, patientId) ?? fail('Patient not found.');
  if (patch.name !== undefined && patch.name.trim().length < 2) fail("Patient's name is required.");
  if (patch.age !== undefined && (patch.age < 0 || patch.age > 120)) fail('Enter a valid age.');
  if (patch.address !== undefined && patch.address.trim().length < 4) fail('Enter the current address.');
  for (const [label, v] of [['Mobile number', patch.mobile], ['Alternative number', patch.altMobile]] as const) {
    if (v && v.trim() && !isValidBdMobile(v)) fail(`${label} is not a valid Bangladeshi mobile number.`);
  }
  if (patch.primaryContact) {
    if (patch.primaryContact.name.trim().length < 2) fail("The primary attendant's name is required.");
    if (!isValidBdMobile(patch.primaryContact.mobile)) fail("The primary attendant's mobile number is not valid.");
    patch.primaryContact = { ...patch.primaryContact, mobile: normalizeMobile(patch.primaryContact.mobile) };
  }
  if (patch.secondaryContact && patch.secondaryContact.mobile.trim()) {
    if (!isValidBdMobile(patch.secondaryContact.mobile)) fail('The secondary contact number is not valid.');
    patch.secondaryContact = { ...patch.secondaryContact, mobile: normalizeMobile(patch.secondaryContact.mobile) };
  }
  if (patch.mobile && patch.mobile.trim()) patch.mobile = normalizeMobile(patch.mobile);
  if (patch.altMobile && patch.altMobile.trim()) patch.altMobile = normalizeMobile(patch.altMobile);
  if (patch.nidNumber && patch.nidNumber.trim() && !/^\d{10,17}$/.test(patch.nidNumber.replace(/\s/g, ''))) fail('The NID / birth certificate number must be 10 to 17 digits.');
  Object.assign(p, patch);
}

export function addPatientNote(db: Db, patientId: string, title: string, text: string, by: string, now: Date): void {
  const p = findPatient(db, patientId) ?? fail('Patient not found.');
  if (!title.trim() || !text.trim()) fail('A note needs a title and some text.');
  p.notes.unshift({ id: `N${next(db, 'note')}`, title: title.trim(), text: text.trim(), by, at: nowIso(now) });
}

export function removePatientNote(db: Db, patientId: string, noteId: string): void {
  const p = findPatient(db, patientId) ?? fail('Patient not found.');
  p.notes = p.notes.filter((n) => n.id !== noteId);
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function addPatientDocument(
  db: Db, patientId: string, category: DocumentCategory, file: { name: string; size: number; mime: string }, now: Date, id?: string,
): PatientDocument {
  const p = findPatient(db, patientId) ?? fail('Patient not found.');
  if (file.size > MAX_DOCUMENT_BYTES) fail('Files must be 10 MB or smaller.');
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) fail('Only PDF, JPG and PNG files can be uploaded.');
  const doc: PatientDocument = { id: id ?? `D${next(db, 'document')}`, category, name: file.name, size: file.size, mime: file.mime, uploadedAt: nowIso(now) };
  p.documents.unshift(doc);
  return doc;
}

export function removePatientDocument(db: Db, patientId: string, docId: string): void {
  const p = findPatient(db, patientId) ?? fail('Patient not found.');
  p.documents = p.documents.filter((d) => d.id !== docId);
}

// ───────────────────────── placing a booking ─────────────────────────

export interface BookingInput {
  category: ServiceCategoryId;
  tier: PackageTier;
  hoursPerDay: HoursPerDay;
  totalDays: TotalDays;
  startDate: string;
  startTime: string;
  addOnIds: string[];
  frequency: PaymentFrequency;
  patientId?: string;
  newPatient?: PatientInput;
  consent: boolean;
  instructions?: string[];
  backupContact?: Contact | null;
}

/** Everything the wizard can validate before the final step. */
export function validateBookingInput(input: Partial<BookingInput>, today: string): string | null {
  if (!input.category || !input.tier) return 'Choose a service and package.';
  const pk = packageOf(input.category, input.tier);
  if (!pk) return 'That package does not exist.';
  if (!input.totalDays || !pk.allowedDays.includes(input.totalDays)) return `${pk.name} can be booked for ${pk.allowedDays.join(', ')} days.`;
  if (!input.hoursPerDay || !pk.allowedHours.includes(input.hoursPerDay)) return `${pk.name} is available for ${pk.allowedHours.join(', ')} hours per day.`;
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || input.startDate < today) return 'The service must start today or later.';
  if (!input.startTime || !START_TIMES.includes(input.startTime)) return 'Choose a start time.';
  for (const id of input.addOnIds ?? []) {
    const a = addOnById(id);
    if (!a) return 'An add-on you selected no longer exists.';
    const why = addOnBlockedReason(a, input.totalDays);
    if (why) return `${a.name}: ${why.toLowerCase()}.`;
  }
  if (!input.frequency || !frequencyAllowed(input.frequency, input.totalDays)) return 'Choose a payment frequency that suits the booking length.';
  return null;
}

export function placeBooking(db: Db, ownerId: string, input: BookingInput, now: Date, opts: { id?: string; patientId?: string } = {}): Booking {
  const owner = findAccount(db, ownerId) ?? fail('Sign in to place a booking.');
  if (!owner.roles.includes('user') && !owner.roles.includes('caregiver')) fail('Only customers can place bookings.');
  if (owner.kyc.status !== 'verified') fail('Complete identity verification (NID + selfie) before booking.');
  const today = isoDay(now);
  const invalid = validateBookingInput(input, today);
  if (invalid) fail(invalid);
  if (!input.consent) fail('You must accept the consent terms to continue.');

  const pk = packageOf(input.category, input.tier)!;
  const cat = category(input.category);

  let patient: Patient;
  if (input.patientId) {
    patient = findPatient(db, input.patientId) ?? fail('Patient not found.');
    if (patient.ownerId !== ownerId) fail('That patient does not belong to your account.');
  } else if (input.newPatient) {
    patient = createPatient(db, ownerId, input.newPatient, now, opts.patientId);
  } else {
    return fail('Select or add the patient who will receive care.');
  }

  const addOns = (input.addOnIds ?? []).map((id) => addOnById(id)!).map((a) => ({ id: a.id, name: a.name, provider: a.provider, pricePerDay: a.pricePerDay }));
  const breakdown = price(pk.pricePerDay, input.hoursPerDay, input.totalDays, addOns.reduce((s, a) => s + a.pricePerDay, 0));
  const id = opts.id ?? `CG-${yymmdd(now)}-${pad(next(db, 'booking', 123), 5)}`;

  const booking: Booking = {
    id, ownerId, patientId: patient.id, category: input.category, categoryName: cat.name, tier: input.tier, packageName: pk.name,
    status: 'pending', bookedAt: nowIso(now), startDate: input.startDate, startTime: input.startTime, totalDays: input.totalDays,
    hoursPerDay: input.hoursPerDay, addOns, frequency: input.frequency, breakdown,
    installments: buildInstallments(breakdown, input.frequency, input.startDate), assigned: [], consentAcceptedAt: nowIso(now),
    serviceAddress: patient.address, instructions: input.instructions ?? [], backupContact: input.backupContact ?? patient.secondaryContact, timeline: [],
  };
  log(db, booking, now, 'placed', 'Booking Placed', 'Your booking request has been placed successfully.');
  db.bookings.unshift(booking);

  for (let i = 0; i < booking.totalDays; i++) {
    db.sessions.push({
      id: `${id}-S${pad(i + 1, 2)}`, bookingId: id, index: i + 1, date: addDays(booking.startDate, i), startTime: booking.startTime,
      hours: booking.hoursPerDay, status: 'scheduled', attendance: [], cashLogged: 0, notes: [],
    });
  }
  return booking;
}

// ───────────────────────── admin: confirm / reject / cancel ─────────────────────────

export function adminConfirm(db: Db, bookingId: string, now: Date): void {
  const b = mustBooking(db, bookingId);
  if (b.status !== 'pending') fail('Only pending bookings can be confirmed.');
  b.status = 'confirmed';
  b.confirmedAt = nowIso(now);
  b.depositDueBy = nowIso(new Date(now.getTime() + DEPOSIT_WINDOW_HOURS * 3600 * 1000));
  log(db, b, now, 'confirmed', 'Booking Confirmed', 'Your booking has been confirmed by CareGo+. Please pay the 30% upfront deposit within 24 hours.');
}

function cancelInternal(db: Db, b: Booking, now: Date, reason: string, by: string): void {
  b.status = 'cancelled';
  b.cancelledAt = nowIso(now);
  b.cancelReason = reason;
  for (const s of db.sessions) {
    if (s.bookingId === b.id && (s.status === 'scheduled' || s.status === 'active')) s.status = 'cancelled';
  }
  const paid = bookingPaid(b);
  log(db, b, now, 'cancelled', 'Booking Cancelled', `${reason} (${by}).${paid > 0 ? ` A refund of ৳${paid.toLocaleString('en-IN')} will be reviewed by CareGo+ support.` : ''}`);
}

export function adminReject(db: Db, bookingId: string, reason: string, now: Date): void {
  const b = mustBooking(db, bookingId);
  if (b.status !== 'pending') fail('Only pending bookings can be declined.');
  if (!reason.trim()) fail('Give the customer a reason for declining.');
  cancelInternal(db, b, now, reason.trim(), 'declined by CareGo+');
}

export function cancelBooking(db: Db, bookingId: string, by: 'customer' | 'admin', now: Date, reason = 'Cancelled at your request'): void {
  const b = mustBooking(db, bookingId);
  if (b.status === 'cancelled' || b.status === 'completed') fail('This booking can no longer be cancelled.');
  if (b.status === 'in-progress' && by === 'customer') fail('A service that has already started can only be cancelled by contacting CareGo+ support.');
  cancelInternal(db, b, now, reason, by === 'admin' ? 'cancelled by CareGo+' : 'cancelled by you');
}

// ───────────────────────── payments ─────────────────────────

export interface PaymentInput {
  bookingId: string;
  method: PayMethod;
  /** Defaults to the next unpaid instalment. */
  amount?: number;
  reference?: string;
  collectedBy?: string;
  /** Used by the card simulator: 'declined' creates a failed attempt. */
  simulateOutcome?: 'success' | 'declined';
}

/** Fills the earliest unpaid instalments first. Returns the allocation plan. */
function allocate(b: Booking, amount: number, kind: 'paid' | 'pending'): { seq: number; amount: number }[] {
  const plan: { seq: number; amount: number }[] = [];
  let left = round2(amount);
  for (const i of b.installments) {
    if (left <= EPS) break;
    const room = round2(i.amount - i.paidAmount - i.pendingAmount);
    if (room <= EPS) continue;
    const take = Math.min(room, left);
    if (kind === 'paid') i.paidAmount = round2(i.paidAmount + take);
    else i.pendingAmount = round2(i.pendingAmount + take);
    plan.push({ seq: i.seq, amount: round2(take) });
    left = round2(left - take);
  }
  return plan;
}

export function makePayment(db: Db, input: PaymentInput, now: Date): Payment {
  const b = mustBooking(db, input.bookingId);
  if (b.status === 'pending') fail('You can pay once CareGo+ has confirmed your booking.');
  if (b.status === 'cancelled') fail('This booking was cancelled.');
  const payable = bookingPayable(b);
  if (payable <= EPS) fail('There is nothing left to pay on this booking.');
  const nextI = nextInstallment(b)!;
  const amount = round2(input.amount ?? round2(nextI.amount - nextI.paidAmount - nextI.pendingAmount));
  if (!(amount > 0)) fail('Enter an amount greater than zero.');
  if (amount - payable > EPS) fail(`The most you can pay is ৳${payable.toLocaleString('en-IN')}.`);

  const seq = next(db, `pay:${b.id}`);
  const pay: Payment = {
    id: `INV-${b.id}-${pad(seq, 2)}`, bookingId: b.id, at: nowIso(now), method: input.method, amount, status: 'success',
    reference: input.reference, allocations: [], collectedBy: input.collectedBy,
  };

  if (input.method !== 'Cash to Staff' && input.simulateOutcome === 'declined') {
    pay.status = 'failed';
    pay.note = 'The payment was declined by the gateway.';
    db.payments.unshift(pay);
    log(db, b, now, 'payment', 'Payment Failed', `A ${input.method} payment of ৳${amount.toLocaleString('en-IN')} was declined.`, amount);
    return pay;
  }

  const hadDeposit = depositPaid(b);
  if (input.method === 'Cash to Staff') {
    pay.status = 'pending-verification';
    pay.allocations = allocate(b, amount, 'pending');
    log(db, b, now, 'cash', 'Cash Payment Recorded', `Cash of ৳${amount.toLocaleString('en-IN')} is awaiting verification by CareGo+.`, amount);
  } else {
    pay.allocations = allocate(b, amount, 'paid');
    announcePayment(db, b, pay, hadDeposit, now);
  }
  db.payments.unshift(pay);
  return pay;
}

function announcePayment(db: Db, b: Booking, pay: Payment, hadDeposit: boolean, now: Date): void {
  if (!hadDeposit && depositPaid(b)) {
    log(db, b, now, 'payment', 'Payment Received (30%)', '30% upfront down-payment has been received.', pay.amount);
  } else {
    log(db, b, now, 'payment', 'Payment Received', `Payment of ৳${pay.amount.toLocaleString('en-IN')} received via ${pay.method}.`, pay.amount);
  }
}

export function adminVerifyCash(db: Db, paymentId: string, ok: boolean, now: Date): void {
  const pay = db.payments.find((p) => p.id === paymentId) ?? fail('Payment not found.');
  if (pay.status !== 'pending-verification') fail('This payment has already been reviewed.');
  const b = mustBooking(db, pay.bookingId);
  const hadDeposit = depositPaid(b);
  for (const a of pay.allocations) {
    const inst = b.installments.find((i) => i.seq === a.seq)!;
    inst.pendingAmount = round2(Math.max(0, inst.pendingAmount - a.amount));
    if (ok) inst.paidAmount = round2(inst.paidAmount + a.amount);
  }
  pay.status = ok ? 'success' : 'failed';
  if (!ok) pay.note = 'Cash could not be verified.';
  for (const e of db.ledger) {
    if (e.paymentId === pay.id) e.status = ok ? 'Reconciled' : 'Voided';
  }
  if (ok) announcePayment(db, b, pay, hadDeposit, now);
  else log(db, b, now, 'cash', 'Cash Payment Rejected', `Cash of ৳${pay.amount.toLocaleString('en-IN')} could not be verified and was reversed.`, pay.amount);
}

// ───────────────────────── admin: caregiver assignment ─────────────────────────

/** Kinds of staff acceptable for a booking's roles. */
export function eligibleKinds(cat: ServiceCategoryId, role: 'Primary' | 'Assistant'): StaffKind[] {
  if (role === 'Primary') return [category(cat).primaryKind];
  return ['Caregiver'];
}

const bookingsOverlap = (a: Booking, b: Booking): boolean =>
  a.startDate <= bookingEndDate(b) && b.startDate <= bookingEndDate(a);

/** Caregivers can hold overlapping bookings only while the combined shift hours fit in one day. */
export function caregiverConflict(db: Db, caregiverId: string, target: Booking): Booking | undefined {
  return db.bookings.find((o) =>
    o.id !== target.id && ['confirmed', 'in-progress'].includes(o.status) && o.assigned.some((a) => a.caregiverId === caregiverId)
    && bookingsOverlap(o, target) && o.hoursPerDay + target.hoursPerDay > 24);
}

export function needsAssistant(b: Booking): boolean {
  return !!packageOf(b.category, b.tier)?.hasAssistant;
}

export function adminAssign(db: Db, bookingId: string, primaryId: string, assistantId: string | null, now: Date): void {
  const b = mustBooking(db, bookingId);
  if (!['confirmed', 'in-progress'].includes(b.status)) fail('Caregivers can only be assigned to confirmed bookings.');
  if (!depositPaid(b)) fail('The 30% deposit must be received before caregivers are assigned.');
  const wantAssistant = needsAssistant(b);
  if (wantAssistant && !assistantId) fail(`${b.packageName} needs an assistant caregiver as well as a primary.`);
  if (!wantAssistant && assistantId) fail(`${b.packageName} is staffed by a single ${eligibleKinds(b.category, 'Primary')[0].toLowerCase()}.`);
  if (assistantId === primaryId) fail('The primary and assistant must be different people.');

  const picks: AssignedCaregiver[] = [{ caregiverId: primaryId, role: 'Primary' }];
  if (assistantId) picks.push({ caregiverId: assistantId, role: 'Assistant' });
  for (const p of picks) {
    const c = findCaregiver(db, p.caregiverId) ?? fail('Caregiver not found.');
    if (!c.active || !c.verified) fail(`${c.name} is not available for assignment.`);
    if (!eligibleKinds(b.category, p.role).includes(c.kind)) fail(`${c.name} is a ${c.kind}; a ${eligibleKinds(b.category, p.role).join(' / ')} is required as ${p.role.toLowerCase()}.`);
    const clash = caregiverConflict(db, c.id, b);
    if (clash) fail(`${c.name} is already booked on ${clash.id} for overlapping dates.`);
  }

  const replacing = b.assigned.length > 0;
  b.assigned = picks;
  for (const s of sessionsOf(db, b.id)) {
    if (s.status !== 'scheduled') continue;
    s.attendance = picks.map((p) => ({ caregiverId: p.caregiverId, role: p.role }));
  }
  const names = picks.map((p) => `${caregiverName(db, p.caregiverId)} (${p.role.toLowerCase()})`).join(' and ');
  log(db, b, now, 'assigned', replacing ? 'Caregiver(s) Replaced' : 'Caregiver(s) Assigned',
    `${replacing ? 'Your care team was updated: ' : 'Your primary and assistant caregivers have been assigned: '}${names}.`);
}

// ───────────────────────── caregiver: shifts ─────────────────────────

export function activeSessionOf(db: Db, caregiverId: string): Session | undefined {
  return db.sessions.find((s) => s.status === 'active' && s.attendance.some((a) => a.caregiverId === caregiverId && a.checkInAt && !a.checkOutAt));
}

export function sessionsOfCaregiver(db: Db, caregiverId: string): Session[] {
  return db.sessions
    .filter((s) => s.attendance.some((a) => a.caregiverId === caregiverId))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

export function attendanceOf(s: Session, caregiverId: string): Attendance | undefined {
  return s.attendance.find((a) => a.caregiverId === caregiverId);
}

export function checkIn(db: Db, sessionId: string, caregiverId: string, now: Date, geo?: { lat: number; lng: number }): void {
  const s = mustSession(db, sessionId);
  const b = mustBooking(db, s.bookingId);
  const a = attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (a.checkInAt) fail('You have already checked in to this shift.');
  if (!['confirmed', 'in-progress'].includes(b.status)) fail('This booking is not active.');
  if (!depositPaid(b)) fail('The customer has not paid the deposit yet.');
  if (s.status !== 'scheduled' && s.status !== 'active') fail('This shift can no longer be started.');
  if (!db.settings.demoEarlyCheckIn && s.date > isoDay(now)) fail(`This shift starts on ${s.date}. You can check in on the day.`);
  const other = activeSessionOf(db, caregiverId);
  if (other && other.id !== s.id) fail('Finish your current shift before starting another.');

  a.checkInAt = nowIso(now);
  if (geo) a.geo = geo;
  s.status = 'active';
  if (b.status === 'confirmed') {
    b.status = 'in-progress';
    b.startedAt = nowIso(now);
    log(db, b, now, 'started', 'Service Started', `${caregiverName(db, caregiverId)} checked in and started the service.`);
  }
}

/** Gross value of one session for a caregiver: their share of the day rate plus add-ons performed by caregivers. */
export function sessionGross(b: Booking, role: 'Primary' | 'Assistant'): number {
  const hasAssistant = b.assigned.length > 1;
  const share = hasAssistant ? (role === 'Primary' ? PRIMARY_SHARE_WITH_ASSISTANT : 1 - PRIMARY_SHARE_WITH_ASSISTANT) : 1;
  const caregiverAddOns = b.addOns.filter((a) => a.provider === 'Caregiver').reduce((s, a) => s + a.pricePerDay, 0);
  return round2(b.breakdown.adjustedPricePerDay * share + (role === 'Primary' ? caregiverAddOns : 0));
}

export function checkOut(db: Db, sessionId: string, caregiverId: string, now: Date): void {
  const s = mustSession(db, sessionId);
  const b = mustBooking(db, s.bookingId);
  const a = attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (!a.checkInAt) fail('Check in before ending the shift.');
  if (a.checkOutAt) fail('You have already ended this shift.');
  a.checkOutAt = nowIso(now);

  const gross = sessionGross(b, a.role);
  const fee = round2(gross * PLATFORM_COMMISSION_RATE);
  const patient = findPatient(db, b.patientId);
  const clearAt = new Date(now.getTime() + CLEARANCE_DAYS * 86400000);
  db.ledger.push({
    id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'earning', description: `Digital Credit: ${patient?.name ?? b.patientId}`,
    ref: `#${b.id}`, amount: round2(gross - fee), status: 'Reconciled', clearAt: nowIso(clearAt), bookingId: b.id, sessionId: s.id,
    hours: s.hours, gross, fee,
  });
  db.ledger.push({
    id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'commission', description: 'Platform Commission Adj.',
    ref: `#CG-ADJ-${next(db, 'adj', 2200)}`, amount: fee, status: 'Settled', bookingId: b.id, sessionId: s.id,
  });

  const primaryDone = s.attendance.filter((x) => x.role === 'Primary').every((x) => !!x.checkOutAt);
  if (primaryDone) {
    s.status = 'completed';
    log(db, b, now, 'session', `Session ${s.index} Completed`, `Session ${s.index} of ${b.totalDays} was completed.`);
    finalizeBooking(db, b, now);
  }
}

function finalizeBooking(db: Db, b: Booking, now: Date): void {
  if (b.status !== 'in-progress') return;
  const open = sessionsOf(db, b.id).some((s) => s.status === 'scheduled' || s.status === 'active');
  if (open) return;
  b.status = 'completed';
  b.completedAt = nowIso(now);
  log(db, b, now, 'completed', 'Service Ended', 'All sessions have been completed. Thank you for choosing CareGo+.');
}

export const CASH_NOTE = 'Cash received from the family';

export function logCash(db: Db, sessionId: string, caregiverId: string, amount: number, now: Date): Payment {
  const s = mustSession(db, sessionId);
  const b = mustBooking(db, s.bookingId);
  attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (!(amount > 0)) fail('Enter the cash amount you received.');
  if (!['confirmed', 'in-progress', 'completed'].includes(b.status)) fail('This booking is not active.');
  const payable = bookingPayable(b);
  if (amount - payable > EPS) fail(`The family only owes ৳${payable.toLocaleString('en-IN')} on this booking.`);
  const bal = balances(db, caregiverId, now);
  if (bal.cashInHand + amount > db.settings.cashLimit + EPS) {
    fail(`Holding this cash would exceed the ৳${db.settings.cashLimit.toLocaleString('en-IN')} safety limit. Settle your cash balance first.`);
  }
  const pay = makePayment(db, { bookingId: b.id, method: 'Cash to Staff', amount, collectedBy: caregiverId, reference: s.id }, now);
  s.cashLogged = round2(s.cashLogged + amount);
  const patient = findPatient(db, b.patientId);
  db.ledger.push({
    id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'cash-collected', description: `${b.categoryName} Visit - ${patient?.name ?? ''}`,
    ref: `#${b.id}`, amount: round2(amount), status: 'Pending Sync', bookingId: b.id, sessionId: s.id, paymentId: pay.id,
  });
  return pay;
}

export function addSessionNote(db: Db, sessionId: string, caregiverId: string, text: string, now: Date): void {
  const s = mustSession(db, sessionId);
  attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (!text.trim()) fail('Write a note first.');
  s.notes.unshift({ id: `SN${next(db, 'snote')}`, text: text.trim(), at: nowIso(now), by: caregiverId });
}

export function setVitals(db: Db, sessionId: string, caregiverId: string, vitals: { bp: string; pulse: number; spo2: number }, now: Date): void {
  const s = mustSession(db, sessionId);
  attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(vitals.bp)) fail('Enter blood pressure like 120/80.');
  if (!(vitals.pulse >= 30 && vitals.pulse <= 220)) fail('Enter a pulse between 30 and 220 bpm.');
  if (!(vitals.spo2 >= 50 && vitals.spo2 <= 100)) fail('Enter SpO₂ between 50 and 100%.');
  s.vitals = { bp: vitals.bp.replace(/\s/g, ''), pulse: vitals.pulse, spo2: vitals.spo2, at: nowIso(now) };
}

export function requestHandover(db: Db, sessionId: string, caregiverId: string, toId: string, now: Date): void {
  const s = mustSession(db, sessionId);
  const b = mustBooking(db, s.bookingId);
  attendanceOf(s, caregiverId) ?? fail('You are not assigned to this shift.');
  if (s.status === 'completed') fail('This shift is already finished.');
  const to = findCaregiver(db, toId) ?? fail('Choose the caregiver taking over.');
  if (s.attendance.some((a) => a.caregiverId === toId)) fail(`${to.name} is already on this shift.`);
  s.handover = { requestedBy: caregiverId, to: toId, requestedAt: nowIso(now), status: 'requested' };
  log(db, b, now, 'handover', 'Handover Requested', `${caregiverName(db, caregiverId)} requested a handover to ${to.name} for session ${s.index}.`);
}

export function adminHandover(db: Db, sessionId: string, approve: boolean, now: Date): void {
  const s = mustSession(db, sessionId);
  const b = mustBooking(db, s.bookingId);
  const h = s.handover;
  if (!h || h.status !== 'requested') fail('There is no pending handover for this shift.');
  if (approve) {
    const to = findCaregiver(db, h.to) ?? fail('Replacement caregiver not found.');
    const from = s.attendance.find((a) => a.caregiverId === h.requestedBy)!;
    if (from.checkInAt) {
      // The outgoing caregiver already started: they are kept on record and the replacement joins the shift.
      s.attendance.push({ caregiverId: to.id, role: 'Assistant' });
    } else {
      from.caregiverId = to.id;
    }
    h.status = 'approved';
    log(db, b, now, 'handover', 'Handover Approved', `${to.name} will take over from ${caregiverName(db, h.requestedBy)} for session ${s.index}.`);
  } else {
    h.status = 'declined';
    log(db, b, now, 'handover', 'Handover Declined', `The handover request for session ${s.index} was declined.`);
  }
}

// ───────────────────────── caregiver: earnings, ledger, balances ─────────────────────────

export interface Balances {
  /** Cleared earnings the caregiver holds with the platform (net of withdrawals and deductions). */
  digitalHeld: number;
  /** Earnings still inside the clearance window. */
  pendingClearance: number;
  /** Cash collected from families that belongs to the platform. */
  cashInHand: number;
  /** digitalHeld − cashInHand: what can be paid out. */
  netStanding: number;
  withdrawn: number;
}

const live = (e: LedgerEntry): boolean => e.status !== 'Voided';

export function balances(db: Db, caregiverId: string, now: Date): Balances {
  let cleared = 0, pending = 0, cash = 0, deduct = 0, direct = 0, withdrawn = 0;
  for (const e of db.ledger) {
    if (e.caregiverId !== caregiverId || !live(e)) continue;
    switch (e.kind) {
      case 'earning': if (e.clearAt && new Date(e.clearAt) <= now) cleared += e.amount; else pending += e.amount; break;
      case 'cash-collected': cash += e.amount; break;
      case 'settle-deduct': deduct += e.amount; break;
      case 'settle-direct': direct += e.amount; break;
      case 'withdrawal': withdrawn += e.amount; break;
      default: break;
    }
  }
  const digitalHeld = round2(cleared - withdrawn - deduct);
  const cashInHand = round2(cash - deduct - direct);
  return { digitalHeld, pendingClearance: round2(pending), cashInHand, netStanding: round2(digitalHeld - cashInHand), withdrawn: round2(withdrawn) };
}

export function earningStatus(e: LedgerEntry, now: Date): 'Pending' | 'Completed' {
  return e.clearAt && new Date(e.clearAt) <= now ? 'Completed' : 'Pending';
}

/** Ledger rows for a caregiver, oldest first, with the running net-standing balance. */
export function ledgerRows(db: Db, caregiverId: string, now: Date): (LedgerEntry & { balance: number; shownStatus: LedgerEntry['status'] })[] {
  let bal = 0;
  return db.ledger
    .filter((e) => e.caregiverId === caregiverId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((e) => {
      if (live(e)) {
        if (e.kind === 'earning' && e.clearAt && new Date(e.clearAt) <= now) bal += e.amount;
        else if (e.kind === 'cash-collected' || e.kind === 'withdrawal') bal -= e.amount;
        else if (e.kind === 'settle-direct') bal += e.amount;
      }
      const shownStatus: LedgerEntry['status'] = e.kind === 'earning' && !(e.clearAt && new Date(e.clearAt) <= now) ? 'Pending Sync' : e.status;
      return { ...e, balance: round2(bal), shownStatus };
    });
}

export function settleCash(db: Db, caregiverId: string, mode: 'deduct' | 'direct', amount: number, method: string | null, now: Date): void {
  const bal = balances(db, caregiverId, now);
  if (!(amount > 0)) fail('Enter an amount to settle.');
  if (amount - bal.cashInHand > EPS) fail(`You only owe ৳${bal.cashInHand.toLocaleString('en-IN')} in cash.`);
  if (mode === 'deduct') {
    if (amount - bal.digitalHeld > EPS) fail(`Your cleared earnings (৳${Math.max(0, bal.digitalHeld).toLocaleString('en-IN')}) do not cover this amount.`);
    db.ledger.push({
      id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'settle-deduct', description: 'Cash settlement - auto-deducted from earnings',
      ref: `#CG-ADJ-${next(db, 'adj', 2200)}`, amount: round2(amount), status: 'Settled',
    });
  } else {
    if (!method) fail('Choose how you paid (bKash, Nagad or Rocket).');
    db.ledger.push({
      id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'settle-direct', description: `Cash settlement paid via ${method}`,
      ref: `#CG-PAY-${next(db, 'pay', 11000)}`, amount: round2(amount), status: 'Pending Sync', method,
    });
  }
}

export function requestWithdrawal(db: Db, caregiverId: string, amount: number, method: string, now: Date): void {
  const bal = balances(db, caregiverId, now);
  if (!(amount >= MIN_WITHDRAWAL)) fail(`The minimum withdrawal is ৳${MIN_WITHDRAWAL.toLocaleString('en-IN')}.`);
  if (amount - bal.netStanding > EPS) fail(`Only ৳${Math.max(0, bal.netStanding).toLocaleString('en-IN')} is available to withdraw.`);
  db.ledger.push({
    id: `L${next(db, 'ledger')}`, caregiverId, at: nowIso(now), kind: 'withdrawal', description: `Digital Payout to ${method}`,
    ref: `#CG-PAY-${next(db, 'pay', 11000)}`, amount: round2(amount), status: 'Pending Sync', method,
  });
}

export function adminSettleLedgerEntry(db: Db, entryId: string, ok: boolean): void {
  const e = db.ledger.find((l) => l.id === entryId) ?? fail('Ledger entry not found.');
  if (e.status !== 'Pending Sync') fail('This entry has already been processed.');
  e.status = ok ? (e.kind === 'settle-direct' ? 'Reconciled' : 'Settled') : 'Voided';
}

// ───────────────────────── housekeeping ─────────────────────────

/** Time-based rules: lapse unpaid deposits, flag missed shifts, complete finished bookings. Safe to call repeatedly. */
export function tick(db: Db, now: Date): boolean {
  let changed = false;
  const today = isoDay(now);
  for (const b of db.bookings) {
    if (b.status === 'confirmed' && b.depositDueBy && !depositPaid(b) && bookingPendingCash(b) <= EPS && new Date(b.depositDueBy) < now) {
      cancelInternal(db, b, now, 'The 30% deposit was not paid within 24 hours of confirmation', 'automatic');
      changed = true;
    }
    if (b.status === 'in-progress') {
      for (const s of db.sessions) {
        if (s.bookingId === b.id && s.status === 'scheduled' && s.date < today) {
          s.status = 'missed';
          log(db, b, now, 'session', `Session ${s.index} Missed`, `Session ${s.index} on ${s.date} did not take place.`);
          changed = true;
        }
      }
      const before = b.status;
      finalizeBooking(db, b, now);
      if (b.status !== before) changed = true;
    }
  }
  return changed;
}

// ───────────────────────── applications & messages ─────────────────────────

export function submitApplication(db: Db, a: Omit<CaregiverApplication, 'id' | 'status' | 'at'>, now: Date): void {
  if (a.name.trim().length < 2) fail('Enter your full name.');
  if (!isValidBdMobile(a.phone)) fail('Enter a valid mobile number.');
  if (!/^\S+@\S+\.\S+$/.test(a.email)) fail('Enter a valid email address.');
  if (!isValidNid(a.nid)) fail('Enter a valid National ID number (10, 13 or 17 digits).');
  if (!(a.experienceYears >= 0)) fail('Enter your years of experience.');
  db.applications.unshift({ ...a, id: `APP-${pad(next(db, 'application', 0), 3)}`, status: 'pending', at: nowIso(now) });
}

export function decideApplication(db: Db, applicationId: string, approve: boolean, now: Date): void {
  const app = db.applications.find((a) => a.id === applicationId) ?? fail('Application not found.');
  if (app.status !== 'pending') fail('This application has already been decided.');
  app.status = approve ? 'approved' : 'rejected';
  if (!approve) return;
  const id = `CGV-${pad(next(db, 'caregiverId', db.caregivers.length), 2)}`;
  db.caregivers.push({
    id, name: app.name, kind: app.kind, age: 28, gender: 'Female', languages: ['Bangla'], nationality: 'Bangladeshi', experienceYears: app.experienceYears,
    rating: 0, reviews: 0, verified: true, phone: normalizeMobile(app.phone), active: true,
  });
  db.accounts.push({
    id: `acc-${next(db, 'account', 10)}`, name: app.name, identifier: app.email, password: 'welcome123', roles: ['caregiver'], caregiverId: id,
    kyc: { status: 'verified', nid: app.nid, selfieName: 'application', verifiedAt: nowIso(now) }, createdAt: nowIso(now),
  });
}

export function submitMessage(db: Db, m: Omit<ContactMessage, 'id' | 'at' | 'handled'>, now: Date): void {
  if (m.name.trim().length < 2) fail('Enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(m.email) && !isValidBdMobile(m.phone)) fail('Enter a valid email or phone number so we can reach you.');
  if (m.message.trim().length < 5) fail('Tell us a little more about what you need.');
  db.messages.unshift({ ...m, id: `MSG-${pad(next(db, 'message'), 3)}`, at: nowIso(now), handled: false });
}

export function statusLabel(s: BookingStatus): string {
  return { pending: 'Pending', confirmed: 'Confirmed', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[s];
}

// ───────────────────────── accounts ─────────────────────────

const normId = (s: string): string => s.trim().toLowerCase();
const isEmail = (s: string): boolean => /^\S+@\S+\.\S+$/.test(s.trim());

/** Phone numbers are compared in a canonical +880 form so "01712345678" and "+8801712345678" match. */
export function canonicalIdentifier(raw: string): string {
  return isEmail(raw) ? normId(raw) : isValidBdMobile(raw) ? normalizeMobile(raw) : normId(raw);
}

export function authenticate(db: Db, identifier: string, password: string): Account | undefined {
  const id = canonicalIdentifier(identifier);
  return db.accounts.find((a) => canonicalIdentifier(a.identifier) === id && a.password === password);
}

export function registerAccount(db: Db, name: string, identifier: string, password: string, now: Date): Account {
  if (name.trim().length < 2) fail('Please enter your full name.');
  if (!isEmail(identifier) && !isValidBdMobile(identifier)) fail('Enter a valid email address or Bangladeshi mobile number.');
  if (password.length < 8) fail('Password must be at least 8 characters.');
  const id = canonicalIdentifier(identifier);
  if (db.accounts.some((a) => canonicalIdentifier(a.identifier) === id)) fail('An account with this email or phone already exists. Try signing in.');
  const acc: Account = {
    id: `acc-${next(db, 'account', 10)}`, name: name.trim(), identifier: isEmail(identifier) ? normId(identifier) : normalizeMobile(identifier),
    password, roles: ['user'], kyc: { status: 'unverified' }, createdAt: nowIso(now),
  };
  db.accounts.push(acc);
  return acc;
}

/** One-line status shown on booking cards ("Awaiting admin confirmation", "30% payment received", ...). */
export function statusNote(b: Booking): string {
  switch (b.status) {
    case 'pending': return 'Awaiting admin confirmation';
    case 'confirmed':
      if (!depositPaid(b)) return b.installments[0].pendingAmount > 0 ? 'Deposit awaiting verification' : 'Awaiting 30% deposit';
      return b.assigned.length ? 'Caregivers assigned' : '30% payment received';
    case 'in-progress': return 'Caregiver is providing service';
    case 'completed': return 'Service completed';
    default: return 'Booking cancelled';
  }
}

/** Longer explanation under the status on a booking's detail header. */
export function statusHint(b: Booking): string {
  switch (b.status) {
    case 'pending': return 'We will notify you once your booking is confirmed.';
    case 'confirmed':
      return depositPaid(b) ? (b.assigned.length ? 'Your care team is ready for the start date.' : 'CareGo+ is matching caregivers for you.')
        : 'Pay the 30% upfront deposit within 24 hours to secure your slot.';
    case 'in-progress': return 'Your caregivers are providing the service.';
    case 'completed': return 'Thank you for choosing CareGo+.';
    default: return b.cancelReason ?? 'This booking has been cancelled.';
  }
}

export function paidPercent(b: Booking): number {
  return Math.round((bookingPaid(b) / b.breakdown.total) * 100);
}

/** Customer-editable logistics of a live booking (where, how to get in, who to call). */
export function updateBookingLogistics(
  db: Db, bookingId: string, patch: { serviceAddress?: string; instructions?: string[]; backupContact?: Contact | null },
): void {
  const b = mustBooking(db, bookingId);
  if (b.status === 'completed' || b.status === 'cancelled') fail('This booking can no longer be edited.');
  if (patch.serviceAddress !== undefined) {
    if (patch.serviceAddress.trim().length < 4) fail('Enter the full service address.');
    b.serviceAddress = patch.serviceAddress.trim();
  }
  if (patch.instructions !== undefined) b.instructions = patch.instructions.map((i) => i.trim()).filter(Boolean);
  if (patch.backupContact !== undefined) {
    const c = patch.backupContact;
    if (c && (c.name.trim() || c.mobile.trim())) {
      if (c.name.trim().length < 2) fail('Enter the backup contact\'s name.');
      if (!isValidBdMobile(c.mobile)) fail('Enter a valid phone number for the backup contact.');
      b.backupContact = { name: c.name.trim(), relation: c.relation.trim(), mobile: normalizeMobile(c.mobile) };
    } else {
      b.backupContact = null;
    }
  }
}

// ───────────────────────── saved payment methods ─────────────────────────

export function addSavedMethod(db: Db, ownerId: string, type: 'bKash' | 'Nagad' | 'Visa Card' | 'Mastercard', number: string): void {
  const digits = number.replace(/[\s-]/g, '');
  let masked: string;
  if (type === 'bKash' || type === 'Nagad') {
    if (!isValidBdMobile(digits)) fail(`Enter the ${type} mobile number (e.g. 01712345678).`);
    const n = digits.replace(/^\+?880/, '0').replace(/^1/, '01');
    masked = `${n.slice(0, 4)} **** ${n.slice(-4)}`;
  } else {
    if (!/^\d{13,19}$/.test(digits)) fail('Enter the full card number.');
    let sum = 0;
    [...digits].reverse().forEach((ch, i) => { let n = Number(ch); if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } sum += n; });
    if (sum % 10 !== 0) fail('That card number is not valid.');
    const first = digits[0];
    if (type === 'Visa Card' && first !== '4') fail('That does not look like a Visa card number.');
    if (type === 'Mastercard' && !['5', '2'].includes(first)) fail('That does not look like a Mastercard number.');
    masked = `**** **** **** ${digits.slice(-4)}`;
  }
  if (db.savedMethods.some((m) => m.ownerId === ownerId && m.type === type && m.masked === masked)) fail('That payment method is already saved.');
  db.savedMethods.push({ id: `m${next(db, 'method', 4)}`, ownerId, type, masked });
}

export function removeSavedMethod(db: Db, ownerId: string, methodId: string): void {
  db.savedMethods = db.savedMethods.filter((m) => !(m.id === methodId && m.ownerId === ownerId));
}


// ───────────────────────── admin housekeeping ─────────────────────────

export function markMessageHandled(db: Db, id: string, handled = true): void {
  const m = db.messages.find((x) => x.id === id) ?? fail('Message not found.');
  m.handled = handled;
}

export function setCaregiverActive(db: Db, caregiverId: string, active: boolean): void {
  const c = findCaregiver(db, caregiverId) ?? fail('Caregiver not found.');
  if (!active) {
    const live = db.bookings.find((b) => ['confirmed', 'in-progress'].includes(b.status) && b.assigned.some((a) => a.caregiverId === caregiverId));
    if (live) fail(`${c.name} is assigned to ${live.id}. Replace them on that booking first.`);
  }
  c.active = active;
}

export function updateSettings(db: Db, patch: { demoEarlyCheckIn?: boolean; cashLimit?: number }): void {
  if (patch.cashLimit !== undefined) {
    if (!(patch.cashLimit >= 1000)) fail('The cash safety limit must be at least ৳1,000.');
    db.settings.cashLimit = Math.round(patch.cashLimit);
  }
  if (patch.demoEarlyCheckIn !== undefined) db.settings.demoEarlyCheckIn = patch.demoEarlyCheckIn;
}

/** Caregivers who could fill a role on a booking right now (right kind, active, no clashing job). */
export function assignableCaregivers(db: Db, booking: Booking, role: 'Primary' | 'Assistant'): { caregiver: Caregiver; conflict?: string }[] {
  const kinds = eligibleKinds(booking.category, role);
  return db.caregivers
    .filter((c) => c.active && c.verified && kinds.includes(c.kind))
    .map((c) => ({ caregiver: c, conflict: caregiverConflict(db, c.id, booking)?.id }));
}
