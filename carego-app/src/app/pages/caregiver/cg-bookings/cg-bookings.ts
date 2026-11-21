import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { ShiftActions } from '../../../core/shift-actions';
import { Booking } from '../../../core/models';
import { activeSessionOf } from '../../../core/domain/engine';
import { addDays, fmtDay } from '../../../core/domain/catalog';
import { CgHeader } from '../../../shared/cg-parts/cg-parts';

type Tab = 'All Bookings' | 'Active' | 'Upcoming' | 'Completed';
const PAGE = 10;

@Component({
  selector: 'app-cg-bookings',
  imports: [RouterLink, FormsModule, CgHeader],
  templateUrl: './cg-bookings.html',
  styleUrl: './cg-bookings.css',
  host: { class: 'block min-h-screen lg:ml-sidebar-width pb-24 lg:pb-8' },
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
  /** Tile colours match the status chips below (and the tones on the schedule page). */
  protected readonly statCards = computed(() => {
    const s = this.stats();
    return [
      { label: 'Total', value: s.total, hint: 'All time', icon: 'fa-regular fa-calendar text-carego-dark', tile: 'bg-slate-100' },
      { label: 'Active', value: s.active, hint: 'In progress', icon: 'fa-solid fa-bolt text-carego-teal', tile: 'bg-carego-light-teal' },
      { label: 'Upcoming', value: s.upcoming, hint: 'Scheduled', icon: 'fa-regular fa-clock text-sky-700', tile: 'bg-sky-50' },
      { label: 'Completed', value: s.completed, hint: 'Finished', icon: 'fa-solid fa-check text-gray-500', tile: 'bg-gray-100' },
    ];
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
    if (!s) return '—';
    const today = this.data.today();
    const day = s.date === today ? 'Today' : s.date === addDays(today, 1) ? 'Tomorrow' : fmtDay(s.date);
    return `${day} · ${s.startTime}`;
  }

  protected end(sessionId: string): void {
    if (confirm('End this shift now? Your earning for the shift will be credited.')) this.actions.checkOut(sessionId);
  }

  protected statusLabel(b: Booking): { text: string; chip: string; border: string } {
    return b.status === 'in-progress' ? { text: 'Active', chip: 'bg-carego-light-teal text-carego-teal', border: 'border-l-carego-teal' }
      : b.status === 'confirmed' ? { text: 'Upcoming', chip: 'bg-sky-50 text-sky-700', border: 'border-l-sky-400' }
      : { text: 'Completed', chip: 'bg-gray-100 text-gray-600', border: 'border-l-gray-300' };
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
