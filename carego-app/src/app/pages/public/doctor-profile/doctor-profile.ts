import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { ConsultMode } from '../../../core/models';
import { doctorById, doctorsIn, fullName, label12, nextDays, scheduleOf, slotsFor, specialtyById } from '../../../core/domain/consult';
import { parseDay } from '../../../core/domain/catalog';
import { Avatar } from '../../../shared/avatar/avatar';
import { DoctorCard } from '../../../shared/doctor-card/doctor-card';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One doctor: credentials, schedule and the slot picker that starts a booking. */
@Component({
  selector: 'app-doctor-profile',
  imports: [RouterLink, DecimalPipe, Avatar, DoctorCard],
  templateUrl: './doctor-profile.html',
})
export class DoctorProfilePage {
  private readonly data = inject(Data);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  /** Set when arriving from "Book follow-up" on a completed consultation. */
  protected readonly followUp = this.route.snapshot.queryParamMap.get('followUp');

  protected readonly doctor = computed(() => doctorById(this.id()));
  protected readonly name = computed(() => (this.doctor() ? fullName(this.doctor()!) : ''));
  protected readonly specialty = computed(() => (this.doctor() ? specialtyById(this.doctor()!.specialtyId) : undefined));
  protected readonly others = computed(() => (this.doctor() ? doctorsIn(this.doctor()!.specialtyId).filter((d) => d.id !== this.doctor()!.id) : []));

  protected readonly mode = signal<ConsultMode>('video');
  protected readonly date = signal('');
  protected readonly time = signal('');

  protected readonly days = computed(() => {
    const d = this.doctor();
    return d ? nextDays(this.data.db(), d.id, this.mode(), this.data.now()).map((x) => ({ ...x, dow: WEEKDAYS[parseDay(x.date).getDay()], num: parseDay(x.date).getDate() })) : [];
  });
  protected readonly slots = computed(() => {
    const d = this.doctor();
    return d && this.date() ? slotsFor(this.data.db(), d.id, this.mode(), this.date(), this.data.now()) : [];
  });
  protected readonly fee = computed(() => (this.followUp ? this.doctor()?.followUpFee ?? 0 : this.doctor()?.fee ?? 0));

  /** "Sat–Thu · 06:00 PM – 09:00 PM" for a schedule. */
  protected hours(mode: ConsultMode): string {
    const s = this.doctor() && scheduleOf(this.doctor()!, mode);
    if (!s) return '';
    const days = s.days.length === 7 ? 'Every day' : [...s.days].sort((a, b) => ((a + 1) % 7) - ((b + 1) % 7)).map((d) => WEEKDAYS[d]).join(', ');
    return `${days} · ${label12(s.start)} – ${label12(s.end)}`;
  }

  constructor(title: Title) {
    effect(() => {
      const d = this.doctor();
      if (!d) return;
      title.setTitle(`CareGo+ | ${fullName(d)}`);
      if (!d.modes.includes(this.mode())) this.mode.set(d.modes[0]);
    });
    // Land on the first day that still has an open slot whenever the doctor or mode changes.
    effect(() => {
      const first = this.days().find((x) => x.open > 0) ?? this.days()[0];
      if (first && !this.days().some((x) => x.date === this.date())) this.date.set(first.date);
    });
  }

  protected setMode(m: ConsultMode): void {
    this.mode.set(m);
    this.date.set('');
    this.time.set('');
  }

  protected pickDate(d: string): void {
    this.date.set(d);
    this.time.set('');
  }

  protected continue(): void {
    const d = this.doctor();
    if (!d || !this.time()) return;
    this.router.navigate(['/app/consultations/book'], {
      queryParams: { doctor: d.id, mode: this.mode(), date: this.date(), time: this.time(), ...(this.followUp ? { followUp: this.followUp } : {}) },
    });
  }
}
