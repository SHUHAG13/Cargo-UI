import { Consultation, ConsultKind, ConsultMode, ConsultPatient, Db, Doctor, DoctorSchedule, PayMethod, Prescription } from '../models';
import { DomainError, atTime, clock } from './engine';
import { addDays, isoDay, parseDay } from './catalog';
import { DOCTORS, INSTANT_OFFERS, InstantOffer, SPECIALTIES } from './doctors';

/** Rules for booking, joining and completing doctor consultations. Same contract as engine.ts: mutate `db`, throw DomainError on a rule violation. */

const fail = (message: string): never => { throw new DomainError(message); };

/** How long before the start time the video room opens, and when an unattended appointment counts as missed. */
export const JOIN_EARLY_MINS = 15;
const MISSED_AFTER_MINS = 60;
const CANCEL_BEFORE_MINS = 60;

export const doctorById = (id: string): Doctor | undefined => DOCTORS.find((d) => d.id === id);
export const specialtyById = (id: string) => SPECIALTIES.find((s) => s.id === id);
export const offerById = (id: string): InstantOffer | undefined => INSTANT_OFFERS.find((o) => o.id === id);
export const doctorsIn = (specialtyId: string): Doctor[] => DOCTORS.filter((d) => d.specialtyId === specialtyId);
export const fullName = (d: Doctor): string => (d.title ? `${d.title} ${d.name}` : d.name);

/** "20:30" → "08:30 PM", the label style bookings already use. */
export function label12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const scheduleOf = (d: Doctor, mode: ConsultMode): DoctorSchedule | undefined => (mode === 'video' ? d.video : d.chamber);
const startOf = (c: Consultation): Date => atTime(c.date, c.time);
const slotLength = (c: Consultation): number => scheduleOf(doctorById(c.doctorId)!, c.mode)?.slotMins ?? 20;

export interface Slot { time: string; state: 'open' | 'taken' | 'past' }

export function slotsFor(db: Db, doctorId: string, mode: ConsultMode, date: string, now: Date): Slot[] {
  const d = doctorById(doctorId);
  const s = d && scheduleOf(d, mode);
  if (!s || !s.days.includes(parseDay(date).getDay())) return [];
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const out: Slot[] = [];
  for (let t = toMin(s.start); t + s.slotMins <= toMin(s.end); t += s.slotMins) {
    const time = label12(`${Math.floor(t / 60)}:${t % 60}`);
    const taken = db.consultations.some((c) => c.doctorId === doctorId && c.date === date && c.time === time && c.status !== 'cancelled');
    out.push({ time, state: taken ? 'taken' : atTime(date, time) <= now ? 'past' : 'open' });
  }
  return out;
}

/** The next `count` days with how many open slots each has (0 = doctor not available that day). */
export function nextDays(db: Db, doctorId: string, mode: ConsultMode, now: Date, count = 7): { date: string; open: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(isoDay(now), i);
    return { date, open: slotsFor(db, doctorId, mode, date, now).filter((s) => s.state === 'open').length };
  });
}

/** A completed consultation can be followed up at the follow-up fee within the doctor's follow-up window, once. */
export function followUpOpen(db: Db, c: Consultation, now: Date): boolean {
  const d = doctorById(c.doctorId);
  if (!d || c.status !== 'completed' || !c.completedAt) return false;
  const until = new Date(c.completedAt).getTime() + d.followUpDays * 86400000;
  return now.getTime() <= until && !db.consultations.some((x) => x.followUpOf === c.id && x.status !== 'cancelled');
}

export function followUpDeadline(c: Consultation): string | null {
  const d = doctorById(c.doctorId);
  return d && c.completedAt ? addDays(isoDay(new Date(c.completedAt)), d.followUpDays) : null;
}

export interface ConsultInput {
  doctorId: string;
  mode: ConsultMode;
  kind: ConsultKind;
  /** Required for scheduled and follow-up visits; instant calls start now. */
  date?: string;
  time?: string;
  patient: ConsultPatient;
  symptoms: string;
  payment: { method: PayMethod; reference: string } | null;
  followUpOf?: string;
  offerId?: string;
}

/** What the patient pays for a visit, before it is booked. */
export function consultFee(db: Db, ownerId: string, input: Pick<ConsultInput, 'doctorId' | 'kind' | 'followUpOf' | 'offerId'>, now: Date): number {
  const d = doctorById(input.doctorId) ?? fail('That doctor is not available.');
  if (input.kind === 'follow-up') {
    const orig = db.consultations.find((c) => c.id === input.followUpOf && c.ownerId === ownerId);
    if (!orig || orig.doctorId !== d.id || !followUpOpen(db, orig, now)) fail('The follow-up window for that consultation has closed. Book a regular appointment instead.');
    return d.followUpFee;
  }
  if (input.kind === 'instant' && input.offerId) {
    const offer = offerById(input.offerId);
    if (offer && offer.specialtyId === d.specialtyId) return offer.price;
  }
  return d.fee;
}

/** The online doctor who takes an instant-offer call (female doctors only for the gynae offer). */
export function doctorForOffer(offer: InstantOffer): Doctor | undefined {
  return doctorsIn(offer.specialtyId).find((d) => d.online && (offer.id !== 'gynae' || d.gender === 'Female'));
}

export function bookConsultation(db: Db, ownerId: string, input: ConsultInput, now: Date): Consultation {
  const d = doctorById(input.doctorId) ?? fail('That doctor is not available.');
  if (!d.modes.includes(input.mode)) fail(`${fullName(d)} does not offer ${input.mode === 'video' ? 'video' : 'chamber'} consultations.`);

  const p = input.patient;
  if (!p.name.trim()) fail('Tell us who the consultation is for.');
  if (!(p.age >= 0 && p.age <= 120)) fail('Enter the patient’s age.');
  if (p.id && !db.patients.some((x) => x.id === p.id && x.ownerId === ownerId)) fail('That patient is not on your account.');
  if (input.symptoms.trim().length < 5) fail('Describe the problem in a few words so the doctor can prepare.');

  let date: string;
  let time: string;
  if (input.kind === 'instant') {
    if (!d.online || input.mode !== 'video') fail(`${fullName(d)} is not online right now. Pick a time slot instead.`);
    date = isoDay(now);
    time = clock(now.toISOString());
  } else {
    if (!input.date || !input.time) fail('Pick a date and time slot.');
    const slot = slotsFor(db, d.id, input.mode, input.date!, now).find((s) => s.time === input.time);
    if (!slot) fail('That time is outside the doctor’s schedule.');
    if (slot!.state === 'taken') fail('Someone just booked that slot. Please pick another time.');
    if (slot!.state === 'past') fail('That time has already passed. Please pick a later slot.');
    date = input.date!;
    time = input.time!;
  }

  const fee = consultFee(db, ownerId, input, now);
  if (fee > 0 && !(input.payment?.method && input.payment.reference)) fail('Choose how you would like to pay.');

  db.counters['consultation'] = (db.counters['consultation'] ?? 1000) + 1;
  const ymd = isoDay(now).slice(2).replace(/-/g, '');
  const c: Consultation = {
    id: `DC-${ymd}-${db.counters['consultation']}`,
    ownerId, doctorId: d.id, patient: { ...p, name: p.name.trim() }, mode: input.mode, kind: input.kind, date, time,
    symptoms: input.symptoms.trim(), status: 'upcoming', fee,
    payment: fee > 0 ? { method: input.payment!.method, reference: input.payment!.reference, at: now.toISOString() } : null,
    bookedAt: now.toISOString(),
    ...(input.followUpOf ? { followUpOf: input.followUpOf } : {}),
  };
  db.consultations.push(c);
  return c;
}

function own(db: Db, ownerId: string, id: string): Consultation {
  const c = db.consultations.find((x) => x.id === id);
  if (!c || c.ownerId !== ownerId) fail('Consultation not found.');
  return c!;
}

export function canCancel(c: Consultation, now: Date): boolean {
  return c.status === 'upcoming' && !c.joinedAt && startOf(c).getTime() - now.getTime() >= CANCEL_BEFORE_MINS * 60000;
}

export function cancelConsultation(db: Db, ownerId: string, id: string, now: Date): Consultation {
  const c = own(db, ownerId, id);
  if (c.status !== 'upcoming') fail('Only upcoming consultations can be cancelled.');
  if (!canCancel(c, now)) fail(`Appointments can be cancelled up to ${CANCEL_BEFORE_MINS} minutes before the start time.`);
  c.status = 'cancelled';
  c.cancelledAt = now.toISOString();
  if (c.payment) c.refund = { amount: c.fee, method: c.payment.method, at: now.toISOString() };
  return c;
}

export function canJoin(db: Db, c: Consultation, now: Date): boolean {
  if (c.status !== 'upcoming' || c.mode !== 'video') return false;
  if (c.kind === 'instant' || c.joinedAt || db.settings.demoEarlyCheckIn) return true;
  return now.getTime() >= startOf(c).getTime() - JOIN_EARLY_MINS * 60000;
}

export function joinCall(db: Db, ownerId: string, id: string, now: Date): Consultation {
  const c = own(db, ownerId, id);
  if (!canJoin(db, c, now)) fail(`The video room opens ${JOIN_EARLY_MINS} minutes before your appointment at ${c.time}.`);
  c.joinedAt = c.joinedAt ?? now.toISOString();
  return c;
}

/** Ends the visit. The doctor's side is simulated in this build, so ending the call issues their prescription. */
export function completeConsultation(db: Db, ownerId: string, id: string, now: Date): Consultation {
  const c = own(db, ownerId, id);
  if (c.status !== 'upcoming') fail('This consultation is already closed.');
  if (c.mode === 'video' && !c.joinedAt) fail('Join the video call first.');
  finish(c, now);
  return c;
}

function finish(c: Consultation, now: Date): void {
  c.status = 'completed';
  c.completedAt = now.toISOString();
  c.prescription = prescriptionFor(c, now);
}

/** Housekeeping: chamber visits complete once their slot ends; unattended video appointments become missed. Returns true if anything changed. */
export function tickConsultations(db: Db, now: Date): boolean {
  let changed = false;
  for (const c of db.consultations ?? []) {
    if (c.status !== 'upcoming') continue;
    const start = startOf(c).getTime();
    if (c.mode === 'chamber' && now.getTime() >= start + slotLength(c) * 60000) { finish(c, new Date(start + slotLength(c) * 60000)); changed = true; }
    else if (c.mode === 'video' && c.joinedAt && now.getTime() >= start + 3 * 3600000) { finish(c, new Date(start + slotLength(c) * 60000)); changed = true; }
    else if (c.mode === 'video' && !c.joinedAt && c.kind !== 'instant' && now.getTime() >= start + MISSED_AFTER_MINS * 60000) { c.status = 'missed'; changed = true; }
  }
  return changed;
}

// ───────────────────────── demo prescriptions ─────────────────────────

const RX: Record<string, Omit<Prescription, 'at' | 'complaints' | 'followUpBy'>> = {
  general: { diagnosis: 'Acute viral fever with upper respiratory tract infection', medicines: [
    { name: 'Tab. Napa 500 mg', dose: '1 + 1 + 1', duration: '5 days', note: 'After meals, only if temperature is above 100°F' },
    { name: 'Tab. Fexo 120 mg', dose: '0 + 0 + 1', duration: '7 days' },
    { name: 'Syp. Tusca Plus', dose: '2 tsp, 3 times daily', duration: '5 days' }],
    tests: ['CBC', 'Dengue NS1 antigen (if fever continues past day 3)'], advice: ['Drink plenty of fluids', 'Take rest and avoid cold drinks', 'Sponge with lukewarm water for high fever'] },
  medicine: { diagnosis: 'Acid peptic disease', medicines: [
    { name: 'Cap. Seclo 20 mg', dose: '1 + 0 + 1', duration: '14 days', note: '30 minutes before meals' },
    { name: 'Tab. Motigut 10 mg', dose: '1 + 1 + 1', duration: '7 days' }],
    tests: ['CBC', 'Ultrasound of whole abdomen'], advice: ['Eat small meals on time', 'Avoid oily and spicy food', 'Do not lie down within 2 hours of eating'] },
  pediatrics: { diagnosis: 'Viral fever with mild dehydration', medicines: [
    { name: 'Syp. Napa (120 mg/5 ml)', dose: '1 tsp every 6 hours', duration: '3 days', note: 'Only if temperature is above 100°F' },
    { name: 'ORS (Orsaline-N)', dose: 'Half a glass after each loose motion', duration: 'Until recovered' }],
    tests: [], advice: ['Continue breast-feeding / normal diet', 'Watch for drowsiness or refusal to drink and call us at once'] },
  gynae: { diagnosis: 'Irregular menstruation — suspected PCOS', medicines: [
    { name: 'Tab. Folison 5 mg', dose: '0 + 1 + 0', duration: '1 month' },
    { name: 'Tab. Normens 5 mg', dose: '1 + 0 + 1', duration: '5 days' }],
    tests: ['Ultrasound of lower abdomen', 'TSH', 'Serum prolactin'], advice: ['Regular exercise for 30 minutes a day', 'Keep a record of your cycle dates'] },
  dermatology: { diagnosis: 'Acne vulgaris (moderate)', medicines: [
    { name: 'Adapalene 0.1% gel', dose: 'Thin layer at night', duration: '8 weeks' },
    { name: 'Clindamycin 1% gel', dose: 'Morning on affected areas', duration: '8 weeks' },
    { name: 'Cap. Doxicap 100 mg', dose: '0 + 1 + 0', duration: '6 weeks', note: 'After lunch with a full glass of water' }],
    tests: [], advice: ['Use a gentle face wash twice daily', 'Do not squeeze pimples', 'Use sunscreen during the day'] },
  cardiology: { diagnosis: 'Essential hypertension', medicines: [
    { name: 'Tab. Amdocal 5 mg', dose: '1 + 0 + 0', duration: 'Continue' },
    { name: 'Tab. Ecosprin 75 mg', dose: '0 + 1 + 0', duration: 'Continue', note: 'After lunch' }],
    tests: ['ECG', 'Lipid profile', 'Serum creatinine'], advice: ['Limit salt to one teaspoon a day', 'Walk 30 minutes daily', 'Check blood pressure every morning and keep a log'] },
  chest: { diagnosis: 'Persistent cough — rule out lower respiratory tract infection', medicines: [
    { name: 'Tab. Azithrocin 500 mg', dose: '1 + 0 + 0', duration: '5 days', note: 'One hour before breakfast' },
    { name: 'Tab. Monas 10 mg', dose: '0 + 0 + 1', duration: '14 days' },
    { name: 'Steam inhalation', dose: 'Twice daily', duration: '7 days' }],
    tests: ['Chest X-ray P/A view', 'CBC with ESR', 'Sputum for AFB (if cough lasts over 2 weeks)'], advice: ['Avoid smoke and dust', 'Breathing exercises 3 times a day', 'Seek emergency care for chest pain or coughing blood'] },
  psychiatry: { diagnosis: 'Generalised anxiety with sleep disturbance', medicines: [
    { name: 'Tab. Sertral 50 mg', dose: '0 + 0 + 1', duration: '1 month', note: 'Do not stop suddenly' }],
    tests: [], advice: ['Keep a fixed sleep and wake time', 'Limit screen time an hour before bed', 'Practise the breathing exercise we discussed'] },
  orthopedics: { diagnosis: 'Mechanical low back pain', medicines: [
    { name: 'Tab. Naprosyn 500 mg', dose: '1 + 0 + 1', duration: '7 days', note: 'After meals' },
    { name: 'Tab. Myolax 50 mg', dose: '1 + 0 + 1', duration: '7 days' }],
    tests: ['X-ray lumbosacral spine (A/P & lateral)'], advice: ['Avoid lifting heavy weights and bending forward', 'Use a firm mattress', 'Warm compress twice daily'] },
  endocrinology: { diagnosis: 'Type 2 diabetes mellitus — suboptimal control', medicines: [
    { name: 'Tab. Comet XR 500 mg', dose: '0 + 0 + 1', duration: 'Continue', note: 'With dinner' },
    { name: 'Tab. Linatab 5 mg', dose: '1 + 0 + 0', duration: 'Continue' }],
    tests: ['HbA1c', 'Fasting blood sugar', 'Serum creatinine'], advice: ['Check fasting sugar 3 days a week', 'Avoid sweets and soft drinks', 'Walk 30 minutes after dinner'] },
  nutrition: { diagnosis: 'Diet plan for healthy weight loss', medicines: [],
    tests: [], advice: ['1,500 kcal daily plan as shared', 'Replace white rice with half a cup of brown rice at lunch', '8 glasses of water daily', 'No sugary drinks or fried snacks'] },
};

function prescriptionFor(c: Consultation, now: Date): Prescription {
  const d = doctorById(c.doctorId)!;
  const t = RX[d.specialtyId] ?? RX['general'];
  return { at: now.toISOString(), complaints: c.symptoms, ...structuredClone(t), followUpBy: addDays(isoDay(now), d.followUpDays) };
}
