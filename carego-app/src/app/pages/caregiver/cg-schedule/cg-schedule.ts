import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { ShiftActions } from '../../../core/shift-actions';
import { describeShift, ShiftView } from '../../../core/shift-view';
import { addDays, fmtDay, isoDay, parseDay } from '../../../core/domain/catalog';
import { CgBottomNav, CgHeader, HandoverDialog } from '../../../shared/cg-parts/cg-parts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-cg-schedule',
  imports: [RouterLink, CgBottomNav, CgHeader, HandoverDialog],
  templateUrl: './cg-schedule.html',
  styleUrl: './cg-schedule.css',
  host: { class: 'block max-w-xl mx-auto min-h-screen pb-24' },
})
export class CgSchedulePage {
  protected readonly data = inject(Data);
  private readonly auth = inject(AuthService);
  protected readonly actions = inject(ShiftActions);

  protected readonly selected = signal(this.data.today());
  protected readonly handoverFor = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  protected readonly views = computed<ShiftView[]>(() => {
    const me = this.auth.caregiverId() ?? '';
    return this.data.myShifts().map((s) => describeShift(this.data.db(), s, me, this.data.today())).filter((v): v is ShiftView => !!v && v.s.status !== 'cancelled');
  });

  protected readonly strip = computed(() => {
    const sel = parseDay(this.selected());
    const start = addDays(this.selected(), -sel.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(start, i);
      const day = this.views().filter((v) => v.s.date === iso);
      return {
        iso, dow: WEEKDAYS[i], num: parseDay(iso).getDate(), today: iso === this.data.today(), selected: iso === this.selected(),
        hasShift: day.length > 0, handover: day.some((v) => v.s.handover?.status === 'requested'),
      };
    });
  });
  protected readonly monthLabel = computed(() => parseDay(this.selected()).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  protected readonly dayViews = computed(() => this.views().filter((v) => v.s.date === this.selected()));
  protected readonly comingUp = computed(() => this.views().filter((v) => v.s.date > this.selected() && v.tone !== 'done').slice(0, 4));

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Schedule');
  }

  protected shiftWeek(delta: number): void {
    this.selected.set(addDays(this.selected(), delta * 7));
  }

  protected pretty(iso: string): string {
    return parseDay(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected rel(iso: string): string {
    return iso === this.data.today() ? 'Today' : iso === addDays(this.data.today(), 1) ? 'Tomorrow' : fmtDay(iso);
  }

  protected canCheckIn(v: ShiftView): boolean {
    return !v.mine?.checkInAt && (v.s.status === 'scheduled' || v.s.status === 'active')
      && (v.s.date <= this.data.today() || this.data.db().settings.demoEarlyCheckIn);
  }

  protected canHandover(v: ShiftView): boolean {
    return v.tone !== 'done' && v.tone !== 'missed' && v.s.handover?.status !== 'requested';
  }

  protected async checkIn(v: ShiftView): Promise<void> {
    this.busy.set(v.s.id);
    await this.actions.checkIn(v.s.id);
    this.busy.set(null);
  }
}
