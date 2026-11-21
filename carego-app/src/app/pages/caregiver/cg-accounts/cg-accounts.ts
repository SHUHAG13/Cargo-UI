import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { BdtPipe } from '../../../core/money.pipe';
import { LedgerKind } from '../../../core/models';
import { CgHeader, SettleDialog, WithdrawDialog } from '../../../shared/cg-parts/cg-parts';

const PAGE = 8;

const FLOW: Record<LedgerKind, { label: string; chip: string }> = {
  'cash-collected': { label: 'Cash Collected', chip: 'bg-blue-100 text-blue-700' },
  withdrawal: { label: 'Withdrawal', chip: 'bg-purple-100 text-purple-700' },
  earning: { label: 'Digital Credit', chip: 'bg-emerald-100 text-emerald-700' },
  commission: { label: 'Internal Flow', chip: 'bg-slate-100 text-slate-600' },
  'settle-deduct': { label: 'Internal Flow', chip: 'bg-slate-100 text-slate-600' },
  'settle-direct': { label: 'Cash Settlement', chip: 'bg-amber-100 text-amber-700' },
};

@Component({
  selector: 'app-cg-accounts',
  imports: [FormsModule, RouterLink, BdtPipe, CgHeader, SettleDialog, WithdrawDialog],
  templateUrl: './cg-accounts.html',
  styleUrl: './cg-accounts.css',
  host: { class: 'block' },
})
export class CgAccountsPage {
  protected readonly data = inject(Data);
  protected readonly auth = inject(AuthService);
  protected readonly flow = FLOW;
  protected readonly withdraw = signal(false);
  protected readonly settle = signal<{ mode: 'deduct' | 'direct'; method: string } | null>(null);
  protected readonly filter = signal<'All' | LedgerKind>('All');
  protected readonly page = signal(1);
  protected readonly limit = computed(() => this.data.db().settings.cashLimit);

  /** Newest first, as on a bank statement. */
  protected readonly rows = computed(() => [...this.data.myLedger()].reverse().filter((r) => this.filter() === 'All' || r.kind === this.filter()));
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE)));
  protected readonly visible = computed(() => this.rows().slice((this.page() - 1) * PAGE, this.page() * PAGE));
  protected readonly canDeduct = computed(() => this.data.myBalances().cashInHand > 0 && this.data.myBalances().digitalHeld > 0);

  constructor(title: Title) {
    title.setTitle('CareGo+ | Accounts & Ledger');
  }

  protected setFilter(f: 'All' | LedgerKind): void { this.filter.set(f); this.page.set(1); }

  protected debit(r: { kind: LedgerKind; amount: number }): number | null {
    return ['cash-collected', 'withdrawal', 'commission', 'settle-deduct'].includes(r.kind) ? r.amount : null;
  }

  protected credit(r: { kind: LedgerKind; amount: number }): number | null {
    return ['earning', 'settle-direct'].includes(r.kind) ? r.amount : null;
  }

  protected exportCsv(): void {
    const rows = [['Date', 'Description', 'Ref', 'Flow', 'Debit', 'Credit', 'Balance', 'Status'],
      ...this.rows().map((r) => [r.at.slice(0, 16).replace('T', ' '), r.description, r.ref, FLOW[r.kind].label, String(this.debit(r) ?? ''), String(this.credit(r) ?? ''), String(r.balance), r.shownStatus])];
    const blob = new Blob([rows.map((l) => l.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ledger.csv';
    a.click();
  }

  protected dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  protected timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}
