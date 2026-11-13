import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { ShiftActions } from '../../../core/shift-actions';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { describeShift } from '../../../core/shift-view';
import { fmtDay } from '../../../core/domain/catalog';
import { CashDialog, CgBottomNav, CgHeader, HandoverDialog } from '../../../shared/cg-parts/cg-parts';
import { Avatar } from '../../../shared/avatar/avatar';

@Component({
  selector: 'app-cg-shift-details',
  imports: [RouterLink, FormsModule, BdtPipe, CgBottomNav, CgHeader, HandoverDialog, CashDialog, Avatar, ...FORMAT_PIPES],
  templateUrl: './cg-shift-details.html',
  styleUrl: './cg-shift-details.css',
  host: { class: 'block max-w-xl mx-auto min-h-screen pb-24' },
})
export class CgShiftDetailsPage {
  protected readonly data = inject(Data);
  private readonly auth = inject(AuthService);
  protected readonly actions = inject(ShiftActions);
  readonly id = input.required<string>();

  protected readonly view = computed(() => {
    const s = this.data.db().sessions.find((x) => x.id === this.id());
    const me = this.auth.caregiverId() ?? '';
    return s && s.attendance.some((a) => a.caregiverId === me) ? describeShift(this.data.db(), s, me, this.data.today()) : undefined;
  });
  protected readonly showHandover = signal(false);
  protected readonly showCash = signal(false);
  protected readonly showNote = signal(false);
  protected readonly showVitals = signal(false);
  protected readonly busy = signal(false);
  protected noteText = '';
  protected bp = '';
  protected pulse: number | null = null;
  protected spo2: number | null = null;

  protected readonly duration = computed(() => {
    const m = this.view()?.mine;
    if (!m?.checkInAt) return '—';
    const end = m.checkOutAt ? new Date(m.checkOutAt) : this.data.now();
    const mins = Math.max(0, Math.round((end.getTime() - new Date(m.checkInAt).getTime()) / 60000));
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m${m.checkOutAt ? '' : ' (running)'}`;
  });
  protected readonly canCheckIn = computed(() => {
    const v = this.view();
    return !!v && !v.mine?.checkInAt && (v.s.status === 'scheduled' || v.s.status === 'active')
      && (v.s.date <= this.data.today() || this.data.db().settings.demoEarlyCheckIn);
  });
  protected readonly checkInBlockedReason = computed(() => {
    const v = this.view();
    if (!v || v.mine?.checkInAt || v.tone === 'done') return '';
    return v.s.date > this.data.today() && !this.data.db().settings.demoEarlyCheckIn ? `This shift starts on ${fmtDay(v.s.date)}. You can check in on the day.` : '';
  });
  protected readonly canHandover = computed(() => {
    const v = this.view();
    return !!v && v.tone !== 'done' && v.tone !== 'missed' && v.s.handover?.status !== 'requested';
  });
  protected readonly bookingPayable = computed(() => {
    const v = this.view();
    return v ? this.data.payable(v.b) : 0;
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | Shift Details');
  }

  protected async checkIn(): Promise<void> {
    this.busy.set(true);
    await this.actions.checkIn(this.id());
    this.busy.set(false);
  }

  protected checkOut(): void {
    if (confirm('End this shift now? Your earning for the shift will be credited.')) this.actions.checkOut(this.id());
  }

  protected saveNote(): void {
    if (this.actions.addNote(this.id(), this.noteText)) {
      this.noteText = '';
      this.showNote.set(false);
    }
  }

  protected saveVitals(): void {
    if (this.actions.setVitals(this.id(), { bp: this.bp, pulse: this.pulse ?? 0, spo2: this.spo2 ?? 0 })) this.showVitals.set(false);
  }

  protected endTime(): string {
    return this.view()?.endsAt ?? '';
  }

  protected prettyDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
