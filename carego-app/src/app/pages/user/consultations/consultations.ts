import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { Consultation, ConsultStatus } from '../../../core/models';
import { canCancel, canJoin, cancelConsultation, doctorById, followUpOpen, fullName } from '../../../core/domain/consult';
import { DayPipe } from '../../../core/format.pipes';
import { Avatar } from '../../../shared/avatar/avatar';

type Tab = 'upcoming' | 'completed' | 'cancelled';

export const CONSULT_STATUS: Record<ConsultStatus, { label: string; chip: string }> = {
  upcoming: { label: 'Upcoming', chip: 'bg-sky-50 text-sky-700' },
  completed: { label: 'Completed', chip: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', chip: 'bg-red-50 text-red-600' },
  missed: { label: 'Missed', chip: 'bg-amber-50 text-amber-700' },
};

/** Customer's doctor consultations: upcoming visits to join, past visits with prescriptions and follow-ups. */
@Component({
  selector: 'app-consultations',
  imports: [RouterLink, DayPipe, Avatar],
  templateUrl: './consultations.html',
})
export class ConsultationsPage {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  protected readonly data = inject(Data);
  protected readonly status = CONSULT_STATUS;

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly all = this.data.myConsultations;
  protected readonly counts = computed(() => {
    const a = this.all();
    return {
      upcoming: a.filter((c) => c.status === 'upcoming').length,
      completed: a.filter((c) => c.status === 'completed' || c.status === 'missed').length,
      cancelled: a.filter((c) => c.status === 'cancelled').length,
      prescriptions: a.filter((c) => c.prescription).length,
      followUps: a.filter((c) => followUpOpen(this.data.db(), c, this.data.now())).length,
    };
  });
  protected readonly kpis = computed(() => [
    { label: 'Upcoming', value: this.counts().upcoming, icon: 'fa-regular fa-calendar', tone: 'bg-sky-50 text-sky-700' },
    { label: 'Completed', value: this.counts().completed, icon: 'fa-solid fa-check', tone: 'bg-gray-100 text-gray-600' },
    { label: 'Prescriptions', value: this.counts().prescriptions, icon: 'fa-solid fa-file-prescription', tone: 'bg-brand-teal-light text-brand-teal' },
    { label: 'Follow-ups available', value: this.counts().followUps, icon: 'fa-solid fa-rotate', tone: 'bg-amber-50 text-amber-700' },
  ]);
  protected readonly tabs = computed<{ id: Tab; label: string; n: number }[]>(() => [
    { id: 'upcoming', label: 'Upcoming', n: this.counts().upcoming },
    { id: 'completed', label: 'Completed', n: this.counts().completed },
    { id: 'cancelled', label: 'Cancelled', n: this.counts().cancelled },
  ]);
  protected readonly visible = computed(() => {
    const t = this.tab();
    const list = this.all().filter((c) => (t === 'completed' ? c.status === 'completed' || c.status === 'missed' : c.status === t));
    // Upcoming reads soonest first; history newest first (the store order).
    return t === 'upcoming' ? [...list].reverse() : list;
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Consultations');
  }

  protected doctor(c: Consultation) { return doctorById(c.doctorId); }
  protected doctorName(c: Consultation): string { const d = this.doctor(c); return d ? fullName(d) : '—'; }
  protected joinable(c: Consultation): boolean { return canJoin(this.data.db(), c, this.data.now()); }
  protected cancellable(c: Consultation): boolean { return canCancel(c, this.data.now()); }
  protected followUp(c: Consultation): boolean { return followUpOpen(this.data.db(), c, this.data.now()); }

  protected cancel(c: Consultation): void {
    if (!confirm(`Cancel your consultation with ${this.doctorName(c)} on ${c.date} at ${c.time}?${c.payment ? ` ৳${c.fee} will be refunded to your ${c.payment.method}.` : ''}`)) return;
    this.store.act((db, now) => cancelConsultation(db, this.auth.account()!.id, c.id, now), 'Consultation cancelled.');
  }
}
