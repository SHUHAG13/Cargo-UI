import { Attendance, Booking, Db, Patient, Session } from './models';
import { attendanceOf, caregiverName, findBooking, findPatient } from './domain/engine';
import { packageOf } from './domain/catalog';

export type ShiftTone = 'active' | 'today' | 'upcoming' | 'done' | 'missed';

/** Everything a caregiver screen needs to know about one shift, resolved from the store. */
export interface ShiftView {
  s: Session;
  b: Booking;
  p: Patient | undefined;
  mine: Attendance | undefined;
  label: string;
  tone: ShiftTone;
  /** Names of the other caregivers on the same shift. */
  others: string[];
  teamText: string;
  directives: string;
  endsAt: string;
}

export function describeShift(db: Db, s: Session, me: string, today: string): ShiftView | undefined {
  const b = findBooking(db, s.bookingId);
  if (!b) return undefined;
  const mine = attendanceOf(s, me);
  const others = s.attendance.filter((a) => a.caregiverId !== me).map((a) => caregiverName(db, a.caregiverId));
  let label: string;
  let tone: ShiftTone;
  if (mine?.checkOutAt || s.status === 'completed') { label = 'Completed'; tone = 'done'; }
  else if (mine?.checkInAt) { label = 'Active — Checked In'; tone = 'active'; }
  else if (s.status === 'cancelled') { label = 'Cancelled'; tone = 'missed'; }
  else if (s.status === 'missed' || (s.status === 'scheduled' && s.date < today)) { label = 'Missed'; tone = 'missed'; }
  else if (s.date === today) { label = 'Today — Not checked in'; tone = 'today'; }
  else { label = 'Upcoming'; tone = 'upcoming'; }
  const features = packageOf(b.category, b.tier)?.features ?? [];
  const team = s.attendance.length > 1 ? `${s.attendance.length}-Caregiver Concurrent Shift` : 'Solo shift';
  const start = new Date(`${s.date}T00:00:00`);
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.startTime);
  if (m) start.setHours((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0), Number(m[2]));
  const end = new Date(start.getTime() + s.hours * 3600000);
  return {
    s, b, p: findPatient(db, b.patientId), mine, label, tone, others, teamText: team,
    directives: features.filter((f) => !f.startsWith('All ')).slice(0, 3).join(', ') || 'Follow the care plan',
    endsAt: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}
