import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { ShiftActions } from '../../../core/shift-actions';
import { Booking } from '../../../core/models';
import { activeSessionOf } from '../../../core/domain/engine';
import { CgBottomNav, CgHeader } from '../../../shared/cg-parts/cg-parts';

type Tab = 'All Bookings' | 'Active' | 'Upcoming' | 'Completed';
const PAGE = 10;

@Component({
  selector: 'app-cg-bookings',
  imports: [RouterLink, FormsModule, CgBottomNav, CgHeader],
  templateUrl: './cg-bookings.html',
  styleUrl: './cg-bookings.css',
  host: { class: 'block max-w-xl mx-auto min-h-screen pb-24' },
})
export class CgBookingsPage {
  protected readonly data = inject(Data);
  private readonly auth = inject(AuthService);
  protected readonly actions = inject(ShiftActions);

  protected readonly tabs: Tab[] = ['All Bookings', 'Active', 'Upcoming', 'Completed'];
  protected readonly tab = signal<Tab>('All Bookings');
  protected readonly search = signal('');
  protected readonly service = signal('All Services');
  protected readonly page = signal(1);

  protected readonly mine = computed(() => this.data.myAssignments().filter((b) => b.status !== 'cancelled'));
  protected readonly stats = computed(() => {
    const m = this.mine();
    const n = (s: string) => m.filter((b) => b.status === s).length;
    return { total: m.length, active: n('in-progress'), upcoming: n('confirmed'), completed: n('completed') };
  });
  protected readonly services = computed(() => ['All Services', ...new Set(this.mine().map((b) => b.categoryName))]);

  protected readonly filtered = computed(() => {
    const t = this.tab();
    const q = this.search().trim().toLowerCase();
    const svc = this.service();
    return this.mine().filter((b) => {
      const p = this.data.patient(b.patientId);
      return (t === 'All Bookings' || (t === 'Active' && b.status === 'in-progress') || (t === 'Upcoming' && b.status === 'confirmed') || (t === 'Completed' && b.status === 'completed'))
        && (svc === 'All Services' || b.categoryName === svc)
        && (!q || b.id.toLowerCase().includes(q) || (p?.name.toLowerCase().includes(q) ?? false));
    });
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE)));
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * PAGE, this.page() * PAGE));

  constructor(title: Title) {
    title.setTitle('CareGo+ | Bookings');
  }

  protected setTab(t: Tab): void { this.tab.set(t); this.page.set(1); }

  protected patient(b: Booking) { return this.data.patient(b.patientId); }

  /** The shift this caregiver is in the middle of for a booking, if any. */
  protected running(b: Booking): string | null {
    const s = activeSessionOf(this.data.db(), this.auth.caregiverId() ?? '');
    return s && s.bookingId === b.id ? s.id : null;
  }

  protected nextShift(b: Booking): string {
    const s = this.data.sessions(b.id).find((x) => x.status === 'scheduled' || x.status === 'active');
    return s ? `${s.date} · ${s.startTime}` : '—';
  }

  protected end(sessionId: string): void {
    if (confirm('End this shift now? Your earning for the shift will be credited.')) this.actions.checkOut(sessionId);
  }

  protected statusLabel(b: Booking): { text: string; cls: string } {
    return b.status === 'in-progress' ? { text: 'Active', cls: 'bg-green-100 text-green-700' }
      : b.status === 'confirmed' ? { text: 'Upcoming', cls: 'bg-sky-100 text-sky-700' } : { text: 'Completed', cls: 'bg-purple-100 text-purple-700' };
  }

  protected exportCsv(): void {
    const rows = [['Booking ID', 'Service', 'Patient', 'Status', 'Start', 'Days'],
      ...this.filtered().map((b) => [b.id, b.categoryName, this.patient(b)?.name ?? '', b.status, b.startDate, String(b.totalDays)])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-bookings.csv';
    a.click();
  }
}
