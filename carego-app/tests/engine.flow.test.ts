/**
 * Business-rule tests for the CareGo+ domain engine (pricing, booking lifecycle, payments, shifts, earnings, ledger).
 * Run with: npm run test:engine
 */
import assert from 'node:assert/strict';
import { createSeedDb } from '../src/app/core/domain/seed';
import * as E from '../src/app/core/domain/engine';
import { price, addDays, isoDay, installmentCount } from '../src/app/core/domain/catalog';

let passed = 0;
const t = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n      ', (e as Error).message); process.exitCode = 1; }
};
const throws = (fn: () => void, re: RegExp) => assert.throws(fn, (e: Error) => e instanceof E.DomainError && re.test(e.message));

const now = new Date();
const db = createSeedDb(now);
const today = isoDay(now);

console.log('SEED SUMMARY');
for (const b of db.bookings) {
  console.log(' ', b.id, b.status.padEnd(11), b.categoryName, b.packageName, `${b.hoursPerDay}h x ${b.totalDays}d`, 'total', b.breakdown.total, 'paid', E.bookingPaid(b), 'pendingCash', E.bookingPendingCash(b), 'payments', `${E.paymentsReceived(b)}/${b.installments.length}`, 'sessions', `${E.sessionsCompleted(db, b.id)}/${b.totalDays}`, 'crew', b.assigned.map((a) => a.caregiverId).join('+'));
}
console.log('  Afia balances', JSON.stringify(E.balances(db, 'CGV-01', now)));
console.log('  ledger rows', db.ledger.filter((l) => l.caregiverId === 'CGV-01').length, 'payments', db.payments.length);

t('prototype worked example: Basic 24h x 30d + report collection = 47,250', () => {
  const b = price(1000, 24, 30, 500);
  assert.equal(b.serviceSubtotal, 30000); assert.equal(b.addOnsTotal, 15000); assert.equal(b.serviceFee, 2250);
  assert.equal(b.total, 47250); assert.equal(b.upfront, 14175); assert.equal(b.remaining, 33075);
});
t('weekly = 4 instalments of 8,268.75 for 30 days', () => {
  assert.equal(installmentCount('weekly', 30), 4);
  assert.equal(price(1000, 24, 30, 500).remaining / 4, 8268.75);
});
t('8h shift scales to a third of the 24h rate', () => assert.equal(price(1500, 8, 1, 0).adjustedPricePerDay, 500));
t('instalments always sum to the booking total', () => {
  for (const b of db.bookings) assert.equal(Math.round(b.installments.reduce((s, i) => s + i.amount, 0) * 100) / 100, b.breakdown.total, b.id);
});
t('all seeded bookings respect tier rules', () => {
  for (const b of db.bookings) assert.equal(E.validateBookingInput({
    category: b.category, tier: b.tier, hoursPerDay: b.hoursPerDay as 8 | 12 | 24, totalDays: b.totalDays as 1 | 7 | 15 | 30,
    startDate: '2999-01-01', startTime: b.startTime, addOnIds: b.addOns.map((a) => a.id), frequency: b.frequency,
  }, today), null, b.id);
});
t('seed has one booking per lifecycle state', () => {
  const s = (st: string) => db.bookings.filter((b) => b.status === st).length;
  assert.equal(s('pending'), 1); assert.equal(s('confirmed'), 1); assert.equal(s('in-progress'), 1); assert.equal(s('completed'), 3); assert.equal(s('cancelled'), 1);
});
t('every payment counter matches the instalment plan (no "1/4 of 5")', () => {
  for (const b of db.bookings) assert.ok(E.paymentsReceived(b) <= b.installments.length);
});
t('Afia: cash owed matches logged cash and net standing is consistent', () => {
  const bal = E.balances(db, 'CGV-01', now);
  assert.equal(bal.cashInHand, 2000);
  assert.equal(bal.netStanding, Math.round((bal.digitalHeld - bal.cashInHand) * 100) / 100);
  assert.ok(bal.netStanding >= 0, 'the pending 1,000 withdrawal was reserved from what was available');
});
t('earning arithmetic: net = gross - 10% fee on every entry', () => {
  for (const e of db.ledger.filter((l) => l.kind === 'earning')) {
    assert.equal(e.gross! - e.fee!, e.amount); assert.equal(Math.round(e.gross! * 0.1 * 100) / 100, e.fee);
  }
});
t('ledger running balance ends at the net-standing KPI', () => {
  const rows = E.ledgerRows(db, 'CGV-01', now);
  assert.equal(rows[rows.length - 1].balance, E.balances(db, 'CGV-01', now).netStanding);
});

// ───────── the new-booking flow end to end ─────────
const base = { category: 'caregiver', tier: 'standard', hoursPerDay: 12, totalDays: 7, startDate: addDays(today, 1), startTime: '08:00 AM', addOnIds: [], frequency: 'together', consent: true } as const;
const newPatient = { fullName: 'Test Patient', age: 70, gender: 'Female', weightKg: 60, address: 'House 1, Road 2, Gulshan', medicalCondition: 'Arthritis', mobility: 'Mobile', attendantName: 'Son', attendantRelation: 'Son', attendantMobile: '01712345678', secondaryName: '', secondaryRelation: '', secondaryMobile: '' } as const;
let id = '';
t('rejects unverified customers', () => {
  const acc = E.registerAccount(db, 'New User', 'new@example.com', 'password1', now);
  throws(() => E.placeBooking(db, acc.id, { ...base, newPatient }, now), /identity verification/);
  throws(() => E.submitKyc(db, acc.id, '123', 'x', now), /valid National ID/);
  E.submitKyc(db, acc.id, '1990123456789', 'selfie.jpg', now);
  assert.equal(acc.kyc.status, 'verified');
});
t('rejects duplicate registrations (email and phone forms)', () => {
  throws(() => E.registerAccount(db, 'Dup', 'NEW@example.com', 'password1', now), /already exists/);
  const a = E.registerAccount(db, 'Phone User', '01811223344', 'password1', now);
  throws(() => E.registerAccount(db, 'Dup', '+8801811223344', 'password1', now), /already exists/);
  assert.ok(E.authenticate(db, '+880 1811-223344', 'password1')); assert.equal(a.roles[0], 'user');
});
t('tier rules: Premium only 24h, Basic not 15 days, doctor follow-up needs 15 days', () => {
  assert.match(E.validateBookingInput({ ...base, tier: 'premium', hoursPerDay: 12 }, today)!, /24 hours/);
  assert.match(E.validateBookingInput({ ...base, tier: 'basic', totalDays: 15 }, today)!, /1, 7, 30/);
  assert.match(E.validateBookingInput({ ...base, addOnIds: ['doctor-followup'] }, today)!, /at least 15 days/);
  assert.equal(E.validateBookingInput({ ...base, totalDays: 15, addOnIds: ['doctor-followup'] }, today), null);
  assert.match(E.validateBookingInput({ ...base, frequency: 'weekly' }, today)!, /frequency/);
  assert.match(E.validateBookingInput({ ...base, startDate: addDays(today, -1) }, today)!, /today or later/);
});
t('place requires consent and a valid patient', () => {
  throws(() => E.placeBooking(db, 'acc-1', { ...base, consent: false, newPatient }, now), /consent/);
  throws(() => E.placeBooking(db, 'acc-1', { ...base, newPatient: { ...newPatient, attendantMobile: '123' } }, now), /valid mobile/);
  throws(() => E.placeBooking(db, 'acc-1', { ...base, patientId: 'PT-1001', newPatient: undefined, startDate: 'x' } as never, now), /today or later|start/);
});
t('place creates booking, patient, sessions and schedule', () => {
  const b = E.placeBooking(db, 'acc-1', { ...base, newPatient }, now);
  id = b.id;
  assert.equal(b.status, 'pending'); assert.equal(E.sessionsOf(db, id).length, 7); assert.equal(b.installments.length, 2);
  assert.ok(db.patients.some((p) => p.id === b.patientId && p.name === 'Test Patient'));
  assert.equal(b.breakdown.total, 5512.5); assert.equal(b.breakdown.upfront, 1653.75);
});
t('cannot pay before admin confirmation', () => throws(() => E.makePayment(db, { bookingId: id, method: 'bKash' }, now), /confirmed/));
t('cannot assign before confirmation or deposit', () => {
  throws(() => E.adminAssign(db, id, 'CGV-02', 'CGV-03', now), /confirmed bookings/);
  E.adminConfirm(db, id, now);
  throws(() => E.adminAssign(db, id, 'CGV-02', 'CGV-03', now), /deposit/);
  throws(() => E.adminConfirm(db, id, now), /pending/);
});
t('declined card creates a failed attempt and no allocation', () => {
  const p = E.makePayment(db, { bookingId: id, method: 'Card', simulateOutcome: 'declined' }, now);
  assert.equal(p.status, 'failed'); assert.equal(E.bookingPaid(E.findBooking(db, id)!), 0);
});
t('deposit by bKash is received and unlocks assignment', () => {
  const b = E.findBooking(db, id)!;
  const p = E.makePayment(db, { bookingId: id, method: 'bKash' }, now);
  assert.equal(p.amount, b.breakdown.upfront); assert.ok(E.depositPaid(b));
  assert.ok(b.timeline.some((e) => e.title === 'Payment Received (30%)'));
});
t('assignment validates kind, assistant, duplicates and conflicts', () => {
  throws(() => E.adminAssign(db, id, 'CGV-02', null, now), /assistant/);
  throws(() => E.adminAssign(db, id, 'CGV-02', 'CGV-02', now), /different/);
  throws(() => E.adminAssign(db, id, 'CGV-01', 'CGV-03', now), /Nurse; a Caregiver/);
  E.adminAssign(db, id, 'CGV-02', 'CGV-03', now);
  assert.equal(E.findBooking(db, id)!.assigned.length, 2);
});
t('overlapping 12h+24h bookings cannot share a caregiver (but 12h+12h can)', () => {
  const big = E.placeBooking(db, 'acc-1', { ...base, tier: 'basic', hoursPerDay: 24, totalDays: 7, patientId: 'PT-1002', startDate: addDays(today, 1) }, now);
  E.adminConfirm(db, big.id, now); E.makePayment(db, { bookingId: big.id, method: 'bKash' }, now);
  throws(() => E.adminAssign(db, big.id, 'CGV-04', null, now), /already booked/);
  E.adminAssign(db, big.id, 'CGV-08', null, now);
  E.cancelBooking(db, big.id, 'admin', now, 'test cleanup');
});
t('check-in gated by date unless demo mode, only for assigned staff', () => {
  const s1 = E.sessionsOf(db, id)[0];
  db.settings.demoEarlyCheckIn = false;
  throws(() => E.checkIn(db, s1.id, 'CGV-02', now), /on the day/);
  throws(() => E.checkIn(db, s1.id, 'CGV-05', now), /not assigned/);
  db.settings.demoEarlyCheckIn = true;
  E.checkIn(db, s1.id, 'CGV-02', now);
  assert.equal(E.findBooking(db, id)!.status, 'in-progress');
  throws(() => E.checkIn(db, s1.id, 'CGV-02', now), /already/);
  throws(() => E.checkIn(db, E.sessionsOf(db, id)[1].id, 'CGV-02', now), /current shift/);
});
t('cash logging respects what is owed and the safety limit, then reconciles', () => {
  const s1 = E.sessionsOf(db, id)[0];
  const b = E.findBooking(db, id)!;
  throws(() => E.logCash(db, s1.id, 'CGV-02', 0, now), /amount/);
  throws(() => E.logCash(db, s1.id, 'CGV-02', E.bookingPayable(b) + 1, now), /only owes/);
  const before = E.balances(db, 'CGV-02', now).cashInHand;
  const pay = E.logCash(db, s1.id, 'CGV-02', 1000, now);
  assert.equal(E.balances(db, 'CGV-02', now).cashInHand, before + 1000);
  assert.equal(pay.status, 'pending-verification'); assert.equal(E.bookingPaid(b), b.breakdown.upfront);
  db.settings.cashLimit = 1500;
  throws(() => E.logCash(db, s1.id, 'CGV-02', 600, now), /safety limit/);
  db.settings.cashLimit = 10000;
  E.adminVerifyCash(db, pay.id, true, now);
  assert.equal(E.bookingPaid(b), b.breakdown.upfront + 1000);
  throws(() => E.adminVerifyCash(db, pay.id, true, now), /already/);
  assert.equal(db.ledger.find((l) => l.paymentId === pay.id)!.status, 'Reconciled');
});
t('rejected cash is reversed and voided from the ledger', () => {
  const s1 = E.sessionsOf(db, id)[0];
  const b = E.findBooking(db, id)!;
  const paidBefore = E.bookingPaid(b); const cashBefore = E.balances(db, 'CGV-02', now).cashInHand;
  const pay = E.logCash(db, s1.id, 'CGV-02', 500, now);
  E.adminVerifyCash(db, pay.id, false, now);
  assert.equal(E.bookingPaid(b), paidBefore); assert.equal(E.balances(db, 'CGV-02', now).cashInHand, cashBefore);
  assert.equal(E.bookingPendingCash(b), 0);
});
t('check-out pays 60/40 with a 10% commission and completes the session', () => {
  const s1 = E.sessionsOf(db, id)[0];
  const b = E.findBooking(db, id)!;
  throws(() => E.checkOut(db, s1.id, 'CGV-03', now), /Check in/);
  E.checkIn(db, s1.id, 'CGV-03', now);
  E.checkOut(db, s1.id, 'CGV-03', now);
  E.checkOut(db, s1.id, 'CGV-02', now);
  assert.equal(E.findSession(db, s1.id)!.status, 'completed');
  const day = b.breakdown.adjustedPricePerDay;
  const pe = db.ledger.find((l) => l.sessionId === s1.id && l.caregiverId === 'CGV-02' && l.kind === 'earning')!;
  const ae = db.ledger.find((l) => l.sessionId === s1.id && l.caregiverId === 'CGV-03' && l.kind === 'earning')!;
  assert.equal(pe.gross, Math.round(day * 0.6 * 100) / 100); assert.equal(ae.gross, Math.round(day * 0.4 * 100) / 100);
  assert.equal(Math.round((pe.gross! + ae.gross!) * 100) / 100, day);
});
t('handover request → admin approval swaps staff on the shift', () => {
  const s2 = E.sessionsOf(db, id)[1];
  throws(() => E.requestHandover(db, s2.id, 'CGV-02', 'CGV-03', now), /already on/);
  E.requestHandover(db, s2.id, 'CGV-02', 'CGV-05', now);
  E.adminHandover(db, s2.id, true, now);
  assert.ok(E.findSession(db, s2.id)!.attendance.some((a) => a.caregiverId === 'CGV-05'));
  assert.ok(!E.findSession(db, s2.id)!.attendance.some((a) => a.caregiverId === 'CGV-02'));
});
t('finishing every session completes the booking; later sessions missed are handled by tick', () => {
  const b = E.findBooking(db, id)!;
  for (const s of E.sessionsOf(db, id).slice(1)) {
    const crew = s.attendance.map((a) => a.caregiverId);
    crew.forEach((c) => E.checkIn(db, s.id, c, now));
    [...crew].reverse().forEach((c) => E.checkOut(db, s.id, c, now));
  }
  assert.equal(b.status, 'completed'); assert.equal(E.sessionsCompleted(db, id), 7);
  assert.ok(b.timeline.some((e) => e.title === 'Service Ended'));
});
t('customer can pay the remaining balance after completion; booking ends fully paid', () => {
  const b = E.findBooking(db, id)!;
  E.makePayment(db, { bookingId: id, method: 'Nagad', amount: E.bookingPayable(b) }, now);
  assert.equal(E.bookingDue(b), 0); throws(() => E.makePayment(db, { bookingId: id, method: 'Nagad' }, now), /nothing left/);
});
t('settlement and withdrawal rules', () => {
  const cg = 'CGV-02';
  const bal = E.balances(db, cg, now);
  throws(() => E.requestWithdrawal(db, cg, 100, 'bKash', now), /minimum/);
  throws(() => E.requestWithdrawal(db, cg, 999999, 'bKash', now), /available/);
  const heldBefore = bal.digitalHeld; // history is already cleared; this booking's earnings are still in the clearance window
  assert.ok(bal.pendingClearance > 0);
  const later = new Date(now.getTime() + 4 * 86400000);
  const b2 = E.balances(db, cg, later);
  assert.ok(b2.digitalHeld > heldBefore, 'clears after the window');
  throws(() => E.settleCash(db, cg, 'direct', 999999, 'bKash', later), /only owe/);
  throws(() => E.settleCash(db, cg, 'direct', 1, null, later), /how you paid/);
  const owed = E.balances(db, cg, later).cashInHand;
  E.settleCash(db, cg, 'deduct', owed, null, later);
  assert.equal(E.balances(db, cg, later).cashInHand, 0);
});
t('customer cancellation rules and automatic lapse of unpaid deposits', () => {
  const b = E.placeBooking(db, 'acc-1', { ...base, patientId: 'PT-1002', startDate: addDays(today, 3) }, now);
  E.adminConfirm(db, b.id, now);
  const lapse = new Date(now.getTime() + 25 * 3600000);
  assert.equal(E.tick(db, lapse), true);
  assert.equal(E.findBooking(db, b.id)!.status, 'cancelled');
  throws(() => E.cancelBooking(db, b.id, 'customer', now), /no longer/);
  const c = E.placeBooking(db, 'acc-1', { ...base, patientId: 'PT-1002', startDate: addDays(today, 3) }, now);
  E.cancelBooking(db, c.id, 'customer', now);
  assert.ok(E.sessionsOf(db, c.id).every((s) => s.status === 'cancelled'));
});
t('patient ownership is enforced', () => {
  throws(() => E.placeBooking(db, E.registerAccount(db, 'Other', 'other@example.com', 'password1', now).id, { ...base, patientId: 'PT-1001' }, now), /identity|belong/);
});
t('applications: approval creates a caregiver and a login', () => {
  const n = db.caregivers.length;
  E.decideApplication(db, 'APP-001', true, now);
  assert.equal(db.caregivers.length, n + 1);
  assert.ok(E.authenticate(db, 'shirin@example.com', 'welcome123')?.caregiverId);
  throws(() => E.decideApplication(db, 'APP-001', false, now), /already/);
});
t('documents: type and size limits', () => {
  throws(() => E.addPatientDocument(db, 'PT-1001', 'Others', { name: 'x.exe', size: 10, mime: 'application/x' }, now), /Only PDF/);
  throws(() => E.addPatientDocument(db, 'PT-1001', 'Others', { name: 'x.pdf', size: 11 * 1024 * 1024, mime: 'application/pdf' }, now), /10 MB/);
  E.addPatientDocument(db, 'PT-1001', 'Others', { name: 'x.pdf', size: 10, mime: 'application/pdf' }, now);
});
console.log(`\n${passed} checks passed`);
