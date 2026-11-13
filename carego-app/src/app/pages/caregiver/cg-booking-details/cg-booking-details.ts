import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { ShiftActions } from '../../../core/shift-actions';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { activeSessionOf, bookingEndDate, sessionGross } from '../../../core/domain/engine';
import { PLATFORM_COMMISSION_RATE, packageOf, round2, addDays } from '../../../core/domain/catalog';
import { CgHeader } from '../../../shared/cg-parts/cg-parts';
import { Avatar } from '../../../shared/avatar/avatar';

type CgTab = 'responsibilities' | 'medical' | 'profile' | 'careplan' | 'payment';

@Component({
  selector: 'app-cg-booking-details',
  imports: [RouterLink, BdtPipe, CgHeader, Avatar, ...FORMAT_PIPES],
  templateUrl: './cg-booking-details.html',
  styleUrl: './cg-booking-details.css',
  host: { class: 'block max-w-xl mx-auto min-h-screen pb-24' },
})
export class CgBookingDetailsPage {
  protected readonly data = inject(Data);
  protected readonly auth = inject(AuthService);
  private readonly actions = inject(ShiftActions);
  readonly id = input.required<string>();

  protected readonly tabs: { key: CgTab; label: string }[] = [
    { key: 'responsibilities', label: 'Responsibilities' }, { key: 'medical', label: 'Medical Information' }, { key: 'profile', label: 'Patient Profile' },
    { key: 'careplan', label: 'Care Plan' }, { key: 'payment', label: 'Payment' },
  ];
  protected readonly tab = signal<CgTab>('responsibilities');
  protected readonly showAllNotes = signal(false);
  protected readonly rate = PLATFORM_COMMISSION_RATE;

  protected readonly booking = computed(() => {
    const b = this.data.booking(this.id());
    const me = this.auth.caregiverId();
    return b && b.assigned.some((a) => a.caregiverId === me) ? b : undefined;
  });
  protected readonly patient = computed(() => (this.booking() ? this.data.patient(this.booking()!.patientId) : undefined));
  protected readonly myRole = computed(() => this.booking()?.assigned.find((a) => a.caregiverId === this.auth.caregiverId())?.role ?? 'Primary');
  protected readonly sessions = computed(() => (this.booking() ? this.data.sessions(this.booking()!.id) : []));
  /** The shift in progress, otherwise the next one coming up, otherwise the last. */
  protected readonly focus = computed(() => {
    const ss = this.sessions();
    return ss.find((s) => s.status === 'active') ?? ss.find((s) => s.status === 'scheduled') ?? ss[ss.length - 1];
  });
  protected readonly running = computed(() => {
    const s = activeSessionOf(this.data.db(), this.auth.caregiverId() ?? '');
    return s && s.bookingId === this.id() ? s : null;
  });
  protected readonly notes = computed(() =>
    this.sessions().flatMap((s) => s.notes.map((n) => ({ ...n, session: s.index }))).sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly latestVitals = computed(() => this.sessions().filter((s) => s.vitals).map((s) => s.vitals!).sort((a, b) => b.at.localeCompare(a.at))[0]);
  protected readonly responsibilities = computed(() => {
    const b = this.booking();
    if (!b) return [] as string[];
    const feats = (packageOf(b.category, b.tier)?.features ?? []).filter((f) => !f.startsWith('All '));
    const extras = b.addOns.filter((a) => a.provider === 'Caregiver').map((a) => a.name);
    return this.myRole() === 'Primary'
      ? [...feats, ...extras]
      : ['Support the primary caregiver with daily activities', 'Mobility support and safe transfers', 'Report any change in the patient\'s condition immediately'];
  });
  protected readonly pay = computed(() => {
    const b = this.booking();
    if (!b) return null;
    const gross = sessionGross(b, this.myRole());
    const fee = round2(gross * PLATFORM_COMMISSION_RATE);
    const left = this.sessions().filter((s) => s.status === 'scheduled' || s.status === 'active').length;
    return { gross, fee, net: round2(gross - fee), perHour: round2(gross / b.hoursPerDay), hours: b.hoursPerDay, left, remaining: round2((gross - fee) * left) };
  });
  protected readonly daysLeft = computed(() => this.sessions().filter((s) => s.status === 'scheduled' || s.status === 'active').length);
  protected readonly endDate = computed(() => (this.booking() ? bookingEndDate(this.booking()!) : ''));

  constructor(title: Title) {
    title.setTitle('CareGo+ | Booking Details');
  }

  protected end(): void {
    const s = this.running();
    if (s && confirm('End this shift now? Your earning for the shift will be credited.')) this.actions.checkOut(s.id);
  }

  protected vitalStatus(kind: 'bp' | 'pulse' | 'spo2'): string {
    const v = this.latestVitals();
    if (!v) return '—';
    if (kind === 'bp') { const [s, d] = v.bp.split('/').map(Number); return s < 130 && d < 85 ? 'Normal' : s < 140 && d < 90 ? 'Elevated' : 'High'; }
    if (kind === 'pulse') return v.pulse >= 60 && v.pulse <= 100 ? 'Normal' : 'Check';
    return v.spo2 >= 95 ? 'Good' : v.spo2 >= 90 ? 'Low' : 'Critical';
  }

  protected shiftEnd(s: { date: string; startTime: string; hours: number }): string {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.startTime);
    const d = new Date(`${s.date}T00:00:00`);
    if (m) d.setHours((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0), Number(m[2]));
    const end = new Date(d.getTime() + s.hours * 3600000);
    return `${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  protected after(iso: string, n: number): string { return addDays(iso, n); }
}
