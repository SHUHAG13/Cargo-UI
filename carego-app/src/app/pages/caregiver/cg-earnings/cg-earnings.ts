import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { BdtPipe } from '../../../core/money.pipe';
import { LedgerEntry } from '../../../core/models';
import { earningStatus } from '../../../core/domain/engine';
import { CLEARANCE_DAYS } from '../../../core/domain/catalog';
import { WithdrawDialog } from '../../../shared/cg-parts/cg-parts';

type Status = 'All' | 'Completed' | 'Withdrawn' | 'Pending';
const PAGE = 8;

@Component({
  selector: 'app-cg-earnings',
  imports: [FormsModule, BdtPipe, WithdrawDialog],
  templateUrl: './cg-earnings.html',
  styleUrl: './cg-earnings.css',
  host: { class: 'block' },
})
export class CgEarningsPage {
  protected readonly data = inject(Data);
  protected readonly auth = inject(AuthService);
  protected readonly clearance = CLEARANCE_DAYS;
  protected readonly withdraw = signal(false);
  protected readonly chartMode = signal<'bar' | 'line'>('bar');
  protected readonly status = signal<Status>('All');
  protected readonly monthOnly = signal(false);
  protected readonly page = signal(1);

  /** Earnings in the ledger as table rows. Withdrawn = the oldest cleared earnings that the payouts to date already cover. */
  protected readonly rows = computed(() => {
    const now = this.data.now();
    const mine = this.data.db().ledger.filter((e) => e.caregiverId === this.auth.caregiverId() && e.kind === 'earning' && e.status !== 'Voided')
      .sort((a, b) => a.at.localeCompare(b.at));
    let paidOut = this.data.myBalances().withdrawn;
    return mine.map((e) => {
      let status: 'Pending' | 'Completed' | 'Withdrawn' = earningStatus(e, now);
      if (status === 'Completed' && paidOut >= e.amount - 0.005) { status = 'Withdrawn'; paidOut -= e.amount; }
      const b = this.data.booking(e.bookingId ?? '');
      return { e, status, service: b?.categoryName ?? 'Care service', patient: b ? this.data.patient(b.patientId)?.name ?? '' : '' };
    }).reverse();
  });

  protected readonly monthKey = computed(() => this.key(this.data.now()));
  protected readonly filtered = computed(() => {
    const s = this.status();
    const mk = this.monthKey();
    return this.rows().filter((r) => (s === 'All' || r.status === s) && (!this.monthOnly() || this.key(new Date(r.e.at)) === mk));
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE)));
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * PAGE, this.page() * PAGE));

  protected readonly months = computed(() => {
    const now = this.data.now();
    const out = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const total = this.rows().filter((r) => this.key(new Date(r.e.at)) === this.key(d)).reduce((s, r) => s + r.e.amount, 0);
      return { label: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(), total: Math.round(total * 100) / 100, current: i === 5 };
    });
    const max = Math.max(1, ...out.map((m) => m.total));
    return out.map((m) => ({ ...m, pct: Math.max(m.total > 0 ? 6 : 0, Math.round((m.total / max) * 95)) }));
  });
  protected readonly monthTotal = computed(() => this.months()[5].total);
  protected readonly growth = computed(() => {
    const [prev, cur] = [this.months()[4].total, this.months()[5].total];
    return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  });
  protected readonly linePoints = computed(() => {
    const m = this.months();
    return m.map((x, i) => `${(i / (m.length - 1)) * 100},${100 - x.pct}`).join(' ');
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Earnings');
  }

  private key(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}`;
  }

  protected setStatus(s: Status): void { this.status.set(s); this.page.set(1); }
  protected kLabel(n: number): string { return n >= 1000 ? `৳${(n / 1000).toFixed(1)}k` : `৳${n}`; }

  protected exportCsv(): void {
    const lines = [['Date', 'Service', 'Booking', 'Hours', 'Gross', 'Fee', 'Net', 'Status'],
      ...this.filtered().map((r: { e: LedgerEntry; status: string; service: string }) => [r.e.at.slice(0, 10), r.service, r.e.bookingId ?? '', String(r.e.hours ?? ''), String(r.e.gross ?? ''), String(r.e.fee ?? ''), String(r.e.amount), r.status])];
    const blob = new Blob([lines.map((l) => l.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'earnings.csv';
    a.click();
  }

  protected dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }
}
