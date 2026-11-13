import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { Patient } from '../../../core/models';
import { createPatient, DomainError, PatientInput, sessionsOf } from '../../../core/domain/engine';
import { fmtDay } from '../../../core/domain/catalog';
import { Avatar } from '../../../shared/avatar/avatar';
import { ToastService } from '../../../core/toast';

const blank = (): PatientInput => ({
  fullName: '', age: null, gender: '', weightKg: null, address: '', medicalCondition: '', mobility: 'Mobile',
  attendantName: '', attendantRelation: '', attendantMobile: '', secondaryName: '', secondaryRelation: '', secondaryMobile: '',
});

@Component({
  selector: 'app-my-patients',
  imports: [RouterLink, FormsModule, Avatar, ...FORMAT_PIPES],
  templateUrl: './my-patients.html',
  styleUrl: './my-patients.css',
  host: { class: 'bg-gray-50 text-slate-800 font-sans antialiased' },
})
export class MyPatientsPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly search = signal('');
  protected readonly status = signal<'All Status' | 'Active' | 'Inactive'>('All Status');
  protected readonly sort = signal<'Recently Added' | 'Name (A-Z)'>('Recently Added');
  protected readonly showAdd = signal(false);
  protected draft: PatientInput = blank();
  protected readonly formError = signal('');

  protected readonly stats = computed(() => {
    const bs = this.data.myBookings();
    const n = (s: string) => bs.filter((b) => b.status === s).length;
    return { active: n('in-progress'), upcoming: n('pending') + n('confirmed'), completed: n('completed') };
  });

  protected readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    const list = this.data.myPatients().filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) && (st === 'All Status' || this.data.patientStatus(p.id) === st));
    return this.sort() === 'Name (A-Z)' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Patients');
  }

  /** What to show under a patient: their current booking (and when it next runs), or their last one. */
  protected summary(p: Patient): { label: string; service: string; pkg: string; bookingId: string; past: boolean; nextLabel: string; next: string } {
    const bs = this.data.bookingsOfPatient(p.id);
    const current = bs.find((b) => b.status === 'in-progress') ?? bs.find((b) => b.status === 'confirmed') ?? bs.find((b) => b.status === 'pending');
    if (current) {
      const nextSession = sessionsOf(this.data.db(), current.id).find((s) => s.status === 'scheduled' || s.status === 'active');
      return {
        label: current.status === 'pending' || current.status === 'confirmed' ? 'Upcoming Booking' : 'Active Booking',
        service: current.categoryName, pkg: current.packageName, bookingId: current.id, past: false, nextLabel: 'Next Service',
        next: current.status === 'pending'
          ? `${fmtDay(current.startDate)}, ${current.startTime} (awaiting confirmation)`
          : nextSession ? `${fmtDay(nextSession.date)}, ${nextSession.startTime}` : '—',
      };
    }
    const last = bs[0];
    if (last) {
      const when = last.completedAt ?? last.cancelledAt ?? last.bookedAt;
      return {
        label: 'Last Booking', service: last.categoryName, pkg: last.packageName, bookingId: last.id, past: true,
        nextLabel: last.status === 'cancelled' ? 'Cancelled on' : 'Completed on',
        next: new Date(when).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      };
    }
    return { label: 'Bookings', service: '', pkg: '', bookingId: '', past: false, nextLabel: 'Next Service', next: 'Not scheduled' };
  }

  protected copy(id: string): void {
    navigator.clipboard?.writeText(id).then(() => this.toasts.info(`Copied ${id}`)).catch(() => undefined);
  }

  protected addPatient(): void {
    const owner = this.auth.account()?.id ?? '';
    try {
      const p = this.store.actOrThrow((db, now) => createPatient(db, owner, this.draft, now));
      this.toasts.success(`${p.name} was added as ${p.id}.`);
      this.draft = blank();
      this.formError.set('');
      this.showAdd.set(false);
    } catch (e) {
      if (e instanceof DomainError) this.formError.set(e.message);
      else throw e;
    }
  }
}
