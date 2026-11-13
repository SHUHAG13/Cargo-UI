import { Caregiver, Db, Patient, PayMethod, ServiceCategoryId, PackageTier, HoursPerDay, TotalDays, PaymentFrequency } from '../models';
import { addDays, isoDay } from './catalog';
import {
  adminAssign, adminConfirm, adminSettleLedgerEntry, adminVerifyCash, atTime, blankPatient, cancelBooking, checkIn, checkOut,
  findBooking, logCash, makePayment, placeBooking, requestHandover, requestWithdrawal, settleCash, sessionsOf, tick,
  addSessionNote, setVitals,
} from './engine';

export const DB_VERSION = 3;

const IMG = 'assets/img/';
const mins = (d: Date, m: number): Date => new Date(d.getTime() + m * 60000);
const hrs = (d: Date, h: number): Date => new Date(d.getTime() + h * 3600000);

const CAREGIVERS: Caregiver[] = [
  { id: 'CGV-01', name: 'Afia Islam', kind: 'Nurse', photo: IMG + 'photo-53cf2a21.jpg', age: 30, gender: 'Female', languages: ['Bangla', 'English'], nationality: 'Bangladeshi', experienceYears: 6, rating: 4.9, reviews: 142, verified: true, phone: '+880 1711-223344', active: true },
  { id: 'CGV-02', name: 'Farhana Akter', kind: 'Caregiver', photo: IMG + 'photo-58e11ba2.jpg', age: 32, gender: 'Female', languages: ['Bangla', 'English', 'Hindi'], nationality: 'Bangladeshi', experienceYears: 3, rating: 4.8, reviews: 126, verified: true, phone: '+880 1722-334455', active: true },
  { id: 'CGV-03', name: 'Sharmin Akter', kind: 'Caregiver', photo: IMG + 'photo-50588171.jpg', age: 28, gender: 'Female', languages: ['Bangla', 'English'], nationality: 'Bangladeshi', experienceYears: 2, rating: 4.6, reviews: 98, verified: true, phone: '+880 1733-445566', active: true },
  { id: 'CGV-04', name: 'Rupa Akter', kind: 'Caregiver', age: 34, gender: 'Female', languages: ['Bangla'], nationality: 'Bangladeshi', experienceYears: 5, rating: 4.7, reviews: 87, verified: true, phone: '+880 1744-556677', active: true },
  { id: 'CGV-05', name: 'Shazid Ahmed', kind: 'Caregiver', age: 29, gender: 'Male', languages: ['Bangla', 'English'], nationality: 'Bangladeshi', experienceYears: 3, rating: 4.5, reviews: 61, verified: true, phone: '+880 1755-667788', active: true },
  { id: 'CGV-06', name: 'Nasrin Sultana', kind: 'Nanny', age: 31, gender: 'Female', languages: ['Bangla', 'English'], nationality: 'Bangladeshi', experienceYears: 4, rating: 4.9, reviews: 73, verified: true, phone: '+880 1766-778899', active: true },
  { id: 'CGV-07', name: 'Tania Rahman', kind: 'Nurse', age: 33, gender: 'Female', languages: ['Bangla', 'English'], nationality: 'Bangladeshi', experienceYears: 7, rating: 4.8, reviews: 118, verified: true, phone: '+880 1777-889900', active: true },
  { id: 'CGV-08', name: 'Mizanur Rahman', kind: 'Caregiver', age: 36, gender: 'Male', languages: ['Bangla'], nationality: 'Bangladeshi', experienceYears: 8, rating: 4.4, reviews: 54, verified: true, phone: '+880 1788-990011', active: true },
];

function patients(now: Date): Patient[] {
  const mk = (id: string, name: string, gender: Patient['gender'], age: number, photo: string, extra: Partial<Patient>): Patient => {
    const p = blankPatient(id, 'acc-1', now);
    p.name = name; p.gender = gender; p.age = age; p.photo = IMG + photo;
    return Object.assign(p, extra);
  };
  const abdul = mk('PT-1001', 'Abdul Karim', 'Male', 72, 'photo-46f63d4e.jpg', {
    weightKg: 68, bloodGroup: 'B+', nidNumber: '1234567890123', mobile: '+880 1712-345678', altMobile: '+880 1912-345679',
    address: 'House 12, Road 5, Dhanmondi, Dhaka-1205', diagnosis: 'Elderly weakness', conditions: ['Diabetes', 'Hypertension'], allergies: 'No known allergies',
    mobility: 'Mobile', functional: { mobility: 'Needs support', toilet: 'Partial assistance', feeding: 'Needs feeding assistance', mental: 'Alert', behavioral: 'None', notes: '' },
    primaryContact: { name: 'Md. Rahim', relation: 'Son', mobile: '+880 1712-987654' },
    secondaryContact: { name: 'Salma Begum', relation: 'Daughter', mobile: '+880 1612-987654' },
    treatingDoctor: 'Dr. Mahbubur Rahman', hospital: 'Square Hospital, Dhaka',
  });
  const rokeya = mk('PT-1002', 'Rokeya Begum', 'Female', 68, 'photo-dbe5b8be.jpg', {
    weightKg: 58, bloodGroup: 'O+', nidNumber: '1987654321098', mobile: '+880 1812-345670', altMobile: '',
    address: 'House 7, Road 11, Banani, Dhaka-1213', diagnosis: 'Recovery after hip replacement', conditions: ['Hypertension'], allergies: 'Penicillin',
    mobility: 'Mobile', functional: { mobility: 'Needs support', toilet: 'Partial assistance', feeding: 'Independent', mental: 'Alert', behavioral: 'None', notes: 'Uses a walker.' },
    primaryContact: { name: 'Nusrat Jahan', relation: 'Daughter', mobile: '+880 1812-111222' }, secondaryContact: null,
    treatingDoctor: 'Dr. Anwar Hossain', hospital: 'United Hospital, Dhaka',
  });
  const mofiz = mk('PT-1003', 'Mofiz Uddin', 'Male', 65, 'photo-9ad12162.jpg', {
    weightKg: 72, bloodGroup: 'A+', nidNumber: '1976543210987', mobile: '+880 1912-345680', altMobile: '',
    address: 'Flat 4B, Mirpur DOHS, Dhaka 1216', diagnosis: 'Post-operative care (knee)', conditions: ['Diabetes'], allergies: 'No known allergies',
    mobility: 'Mobile', functional: { mobility: 'Independent', toilet: 'No assistance', feeding: 'Independent', mental: 'Alert', behavioral: 'None', notes: '' },
    primaryContact: { name: 'Rafiqul Islam', relation: 'Brother', mobile: '+880 1712-345678' }, secondaryContact: null,
    treatingDoctor: 'Dr. Kamal Uddin', hospital: 'Labaid Hospital, Dhaka',
  });
  const tahmina = mk('PT-1004', 'Tahmina Begum', 'Female', 68, 'photo-5bd8035e.jpg', {
    weightKg: 55, bloodGroup: 'B+', nidNumber: '1965432109876', mobile: '+880 1712-345678', altMobile: '',
    address: 'House 15, Road 8, Dhanmondi, Dhaka-1205', diagnosis: 'Post Stroke Care (Ischemic stroke)', conditions: ['Hypertension', 'Paralysis'], allergies: 'No known allergies',
    mobility: 'Mobile', functional: { mobility: 'Needs assistance', toilet: 'Partial assistance', feeding: 'Independent', mental: 'Alert', behavioral: 'None', notes: 'Weakness on the left side. Do not leave alone in the bathroom.' },
    primaryContact: { name: 'Md. Rahim', relation: 'Son', mobile: '+880 1798-765432' },
    secondaryContact: { name: 'Dr. Saiful Islam', relation: 'Physician', mobile: '+880 1812-345678' },
    treatingDoctor: 'Dr. Saiful Islam', hospital: 'Square Hospital, Dhaka',
  });

  const iso = (daysAgo: number, h: number, m: number): string => {
    const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString();
  };
  abdul.documents = [
    { id: 'D1', category: 'Discharge Summary', name: 'Discharge_Summary.pdf', size: 1258291, mime: 'application/pdf', uploadedAt: iso(24, 10, 0) },
    { id: 'D2', category: 'Prescriptions', name: 'Prescription_Latest.pdf', size: 839680, mime: 'application/pdf', uploadedAt: iso(20, 11, 0) },
    { id: 'D3', category: 'Prescriptions', name: 'Prescription_Previous.pdf', size: 686080, mime: 'application/pdf', uploadedAt: iso(50, 9, 0) },
    { id: 'D4', category: 'Investigation Reports', name: 'Blood_Test_Report.pdf', size: 1153434, mime: 'application/pdf', uploadedAt: iso(22, 12, 0) },
    { id: 'D5', category: 'ID Proofs', name: 'NID_Card.pdf', size: 921600, mime: 'application/pdf', uploadedAt: iso(25, 15, 0) },
  ];
  abdul.notes = [
    { id: 'N1', title: 'Care Plan Discussion', text: "Discussed care plan with patient's son. Patient requires full-time caregiver support. Focus on medication, feeding assistance and mobility support.", by: 'Anika Rahman (CareGo+ Team)', at: iso(4, 11, 30) },
    { id: 'N2', title: 'Patient Follow-up', text: 'Patient is doing well. No new complaints. Physiotherapy exercises started from today.', by: 'Anika Rahman (CareGo+ Team)', at: iso(6, 16, 15) },
    { id: 'N3', title: 'Medication Reminder', text: 'Patient needs to take blood pressure medication at 8 AM and 8 PM daily.', by: 'Anika Rahman (CareGo+ Team)', at: iso(9, 10, 0) },
    { id: 'N4', title: 'Initial Assessment', text: 'Initial assessment completed. Patient is weak and needs assistance in daily activities.', by: 'Anika Rahman (CareGo+ Team)', at: iso(12, 14, 20) },
  ];
  tahmina.notes = [
    { id: 'N5', title: 'Initial Assessment', text: 'Weakness on the left side after stroke. Physiotherapy exercises as instructed by the physician.', by: 'Anika Rahman (CareGo+ Team)', at: iso(8, 10, 0) },
  ];
  return [abdul, rokeya, mofiz, tahmina];
}

type Spec = {
  seq: number; patientId: string; category: ServiceCategoryId; tier: PackageTier; hours: HoursPerDay; days: TotalDays;
  startOffset: number; startTime: string; addOns?: string[]; frequency: PaymentFrequency; crew?: [string, string | null];
};

const PAY_ROTATION: PayMethod[] = ['bKash', 'Nagad', 'Card'];

/**
 * Builds demo data by running the real business actions against a simulated clock, so every number
 * (totals, instalments, earnings, ledger) is derived by the same code the app uses at run time.
 */
export function createSeedDb(now: Date): Db {
  const today = isoDay(now);
  const db: Db = {
    version: DB_VERSION,
    accounts: [
      { id: 'acc-1', name: 'Irfan Hossain', identifier: 'customer@carego.demo', password: 'demo1234', roles: ['user'], photo: IMG + 'photo-afb8ffb1.jpg', createdAt: now.toISOString(), kyc: { status: 'verified', nid: '1990123456789', selfieName: 'selfie.jpg', verifiedAt: now.toISOString() } },
      { id: 'acc-2', name: 'Afia Islam', identifier: 'caregiver@carego.demo', password: 'demo1234', roles: ['caregiver', 'user'], caregiverId: 'CGV-01', photo: IMG + 'photo-53cf2a21.jpg', createdAt: now.toISOString(), kyc: { status: 'verified', nid: '1992345678901', selfieName: 'selfie.jpg', verifiedAt: now.toISOString() } },
      { id: 'acc-3', name: 'Anika Rahman', identifier: 'admin@carego.demo', password: 'demo1234', roles: ['admin'], createdAt: now.toISOString(), kyc: { status: 'verified', nid: '1988765432109', selfieName: 'selfie.jpg', verifiedAt: now.toISOString() } },
    ],
    caregivers: CAREGIVERS.map((c) => ({ ...c })),
    patients: patients(now),
    bookings: [], sessions: [], payments: [], ledger: [],
    savedMethods: [
      { id: 'm1', ownerId: 'acc-1', type: 'bKash', masked: '0187 **** 2468' },
      { id: 'm2', ownerId: 'acc-1', type: 'Nagad', masked: '0171 **** 1357' },
      { id: 'm3', ownerId: 'acc-1', type: 'Visa Card', masked: '**** **** **** 4242' },
      { id: 'm4', ownerId: 'acc-1', type: 'Mastercard', masked: '**** **** **** 8888' },
    ],
    applications: [], messages: [],
    settings: { demoEarlyCheckIn: true, cashLimit: 10000 },
    counters: { booking: 123, patient: 4, account: 10, caregiverId: 8 },
  };

  const idFor = (placed: Date, seq: number): string => `CG-${String(placed.getFullYear()).slice(2)}${String(placed.getMonth() + 1).padStart(2, '0')}${String(placed.getDate()).padStart(2, '0')}-${String(seq).padStart(5, '0')}`;
  const place = (spec: Spec, placedAt: Date): string => {
    const id = idFor(placedAt, spec.seq);
    placeBooking(db, 'acc-1', {
      category: spec.category, tier: spec.tier, hoursPerDay: spec.hours, totalDays: spec.days, startDate: addDays(today, spec.startOffset),
      startTime: spec.startTime, addOnIds: spec.addOns ?? [], frequency: spec.frequency, patientId: spec.patientId, consent: true,
    }, placedAt, { id });
    return id;
  };

  /** place → confirm → deposit → assign, all shortly after `placedAt`. */
  const activate = (spec: Spec, placedAt: Date, method: PayMethod = 'bKash'): string => {
    const id = place(spec, placedAt);
    adminConfirm(db, id, mins(placedAt, 5));
    makePayment(db, { bookingId: id, method, reference: 'seed' }, mins(placedAt, 7));
    if (spec.crew) adminAssign(db, id, spec.crew[0], spec.crew[1], mins(placedAt, 10));
    return id;
  };

  const payDue = (id: string, until: Date, from = 0): void => {
    let n = from;
    for (const inst of findBooking(db, id)!.installments.slice(1)) {
      const due = inst.dueDate ? atTime(inst.dueDate, '10:00 AM') : until;
      if (due > until) continue;
      const b = findBooking(db, id)!;
      if (b.installments[inst.seq].paidAmount + b.installments[inst.seq].pendingAmount >= inst.amount - 0.005) continue;
      const left = Math.round((inst.amount - b.installments[inst.seq].paidAmount - b.installments[inst.seq].pendingAmount) * 100) / 100;
      makePayment(db, { bookingId: id, method: PAY_ROTATION[n++ % PAY_ROTATION.length], amount: left, reference: 'seed' }, due);
    }
  };

  const runSession = (sessionId: string, crew: string[], cash?: { by: string; amount: number }): void => {
    const s = sessionsOf(db, sessionId.replace(/-S\d+$/, '')).find((x) => x.id === sessionId)!;
    const start = atTime(s.date, s.startTime);
    crew.forEach((c, i) => checkIn(db, s.id, c, mins(start, 2 + i)));
    if (cash) logCash(db, s.id, cash.by, cash.amount, mins(start, 120));
    const end = hrs(start, s.hours);
    [...crew].reverse().forEach((c, i) => checkOut(db, s.id, c, mins(end, i)));
  };

  // ── History 1: Nursing Standard, 12h × 30d, Afia + Sharmin, finished ~3 months ago ──
  const h3Placed = atTime(addDays(today, -128), '09:15 AM');
  const h3 = activate({ seq: 33, patientId: 'PT-1004', category: 'nursing', tier: 'standard', hours: 12, days: 30, startOffset: -125, startTime: '08:00 AM', frequency: 'weekly', crew: ['CGV-01', 'CGV-03'] }, h3Placed);
  for (const s of sessionsOf(db, h3)) runSession(s.id, ['CGV-01', 'CGV-03']);
  payDue(h3, atTime(addDays(today, -90), '10:00 AM'));

  // ── History 2: Nursing Premium, 24h × 7d, Afia + Farhana, with one cash collection and its settlement ──
  const h2Placed = atTime(addDays(today, -63), '09:15 AM');
  const h2 = activate({ seq: 41, patientId: 'PT-1001', category: 'nursing', tier: 'premium', hours: 24, days: 7, startOffset: -60, startTime: '08:00 AM', frequency: 'together', crew: ['CGV-01', 'CGV-02'] }, h2Placed, 'Card');
  const h2s = sessionsOf(db, h2);
  h2s.forEach((s, i) => runSession(s.id, ['CGV-01', 'CGV-02'], i === 1 ? { by: 'CGV-01', amount: 3000 } : undefined));
  const cashPay = db.payments.find((p) => p.bookingId === h2 && p.status === 'pending-verification')!;
  adminVerifyCash(db, cashPay.id, true, atTime(addDays(today, -58), '11:00 AM'));
  settleCash(db, 'CGV-01', 'direct', 3000, 'Nagad', atTime(addDays(today, -57), '12:00 PM'));
  adminSettleLedgerEntry(db, db.ledger.find((l) => l.kind === 'settle-direct')!.id, true);
  payDue(h2, atTime(addDays(today, -50), '10:00 AM'));
  requestWithdrawal(db, 'CGV-01', 15000, 'bKash', atTime(addDays(today, -50), '14:00 PM'));
  adminSettleLedgerEntry(db, db.ledger.find((l) => l.kind === 'withdrawal')!.id, true);

  // ── History 3: Home Caregiver Basic, 12h × 7d for Mofiz, Farhana, finished ~2.5 weeks ago ──
  const h1Placed = atTime(addDays(today, -27), '09:15 AM');
  const h1 = activate({ seq: 56, patientId: 'PT-1003', category: 'caregiver', tier: 'basic', hours: 12, days: 7, startOffset: -24, startTime: '08:00 AM', frequency: 'together', crew: ['CGV-02', null] }, h1Placed, 'Nagad');
  for (const s of sessionsOf(db, h1)) runSession(s.id, ['CGV-02']);
  payDue(h1, atTime(addDays(today, -16), '10:00 AM'));

  // ── Cancelled before payment ──
  const eId = place({ seq: 65, patientId: 'PT-1001', category: 'caregiver', tier: 'basic', hours: 24, days: 7, startOffset: -18, startTime: '10:00 AM', frequency: 'together' }, atTime(addDays(today, -22), '14:10 PM'));
  cancelBooking(db, eId, 'customer', atTime(addDays(today, -21), '09:00 AM'));

  // ── In progress now: Nursing Standard 12h × 15d for Tahmina (Afia + Rupa), day 6 running ──
  const cPlaced = atTime(addDays(today, -8), '14:40 PM');
  const c = activate({ seq: 76, patientId: 'PT-1004', category: 'nursing', tier: 'standard', hours: 12, days: 15, startOffset: -5, startTime: '08:00 AM', frequency: 'weekly', crew: ['CGV-01', 'CGV-04'] }, cPlaced, 'Card');
  const cs = sessionsOf(db, c);
  runSession(cs[0].id, ['CGV-01', 'CGV-04']);
  // The first weekly instalment falls due the day after the start and is paid online; later the family hands cash to Afia.
  makePayment(db, { bookingId: c, method: 'Card', reference: 'seed' }, atTime(addDays(today, -4), '10:00 AM'));
  for (let i = 1; i < 5; i++) runSession(cs[i].id, ['CGV-01', 'CGV-04'], i === 2 ? { by: 'CGV-01', amount: 2000 } : undefined);
  // Day 6 is running: Afia and Rupa are checked in; Afia asked to hand over the evening to Shazid.
  const nowSession = cs[5];
  const startNow = atTime(nowSession.date, nowSession.startTime);
  const checkInAt = startNow.getTime() < now.getTime() ? mins(startNow, 2) : mins(now, -30);
  checkIn(db, nowSession.id, 'CGV-01', checkInAt);
  checkIn(db, nowSession.id, 'CGV-04', mins(checkInAt, 4));
  setVitals(db, nowSession.id, 'CGV-01', { bp: '128/78', pulse: 76, spo2: 96 }, mins(checkInAt, 20));
  addSessionNote(db, nowSession.id, 'CGV-01', 'Patient was calm and cooperative. Physiotherapy done as instructed. Appetite was good.', mins(checkInAt, 40));
  requestHandover(db, nowSession.id, 'CGV-01', 'CGV-05', mins(checkInAt, 60));

  // ── Confirmed + deposit paid, waiting for the admin to assign caregivers ──
  const bPlaced = new Date(now.getTime() - 30 * 3600000);
  activate({ seq: 98, patientId: 'PT-1002', category: 'caregiver', tier: 'standard', hours: 24, days: 15, startOffset: 2, startTime: '10:00 AM', frequency: 'weekly' }, bPlaced);

  // ── Pending: waiting for admin confirmation ──
  place({ seq: 123, patientId: 'PT-1001', category: 'caregiver', tier: 'basic', hours: 24, days: 30, startOffset: 1, startTime: '10:00 AM', addOns: ['report-collection'], frequency: 'weekly' }, new Date(now.getTime() - 20 * 3600000));

  // A pending withdrawal and two applications / a message for the admin queues
  requestWithdrawal(db, 'CGV-01', 1000, 'Rocket', new Date(now.getTime() - 6 * 3600000));
  db.applications.push(
    { id: 'APP-001', name: 'Shirin Sultana', phone: '01711223344', email: 'shirin@example.com', kind: 'Nurse', experienceYears: 4, nid: '1991122334455', notes: 'BSc in Nursing, 4 years in hospital wards.', status: 'pending', at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    { id: 'APP-002', name: 'Jamal Hossain', phone: '01822334455', email: 'jamal@example.com', kind: 'Caregiver', experienceYears: 6, nid: '1985566778899', notes: 'Experienced with elderly care and dementia support.', status: 'pending', at: new Date(now.getTime() - 86400000).toISOString() },
  );
  db.counters['application'] = 2;
  db.messages.push({ id: 'MSG-001', name: 'Mahbubur Rahman', email: 'mahbub@example.com', phone: '', message: 'Do you provide night-only nursing for post-surgery patients in Uttara?', at: new Date(now.getTime() - 5 * 3600000).toISOString(), handled: false });
  db.counters['message'] = 1;

  tick(db, now);
  return db;
}
