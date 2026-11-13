import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { adminSettleLedgerEntry, adminVerifyCash, balances } from '../../../core/domain/engine';
import { PAYMENT_UI } from '../../../shared/ui';

type Tab = 'cash' | 'payouts' | 'all' | 'holdings';

@Component({
  selector: 'app-admin-payments',
  imports: [RouterLink, FormsModule, BdtPipe, ...FORMAT_PIPES],
  templateUrl: './admin-payments.html',
  host: { class: 'block' },
})
export class AdminPaymentsPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  protected readonly payUi = PAYMENT_UI;
  protected readonly tab = signal<Tab>('cash');
  protected readonly status = signal('All');
  protected readonly method = signal('All');

  protected readonly cash = computed(() => this.data.db().payments.filter((p) => p.status === 'pending-verification'));
  protected readonly payouts = computed(() => this.data.db().ledger.filter((l) => l.status === 'Pending Sync' && (l.kind === 'withdrawal' || l.kind === 'settle-direct')));
  protected readonly processed = computed(() => this.data.db().ledger.filter((l) => (l.kind === 'withdrawal' || l.kind === 'settle-direct') && l.status !== 'Pending Sync').slice(-8).reverse());
  protected readonly all = computed(() => this.data.db().payments.filter((p) =>
    (this.status() === 'All' || PAYMENT_UI[p.status].label === this.status()) && (this.method() === 'All' || p.method === this.method())));
  protected readonly total = computed(() => this.data.db().payments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0));
  protected readonly holdings = computed(() => this.data.db().caregivers.map((c) => ({ c, b: balances(this.data.db(), c.id, this.data.now()) })).filter((x) => x.b.cashInHand > 0 || x.b.digitalHeld > 0 || x.b.pendingClearance > 0));
  protected readonly cashTotal = computed(() => this.holdings().reduce((s, h) => s + h.b.cashInHand, 0));

  constructor(title: Title) {
    title.setTitle('CareGo+ Admin | Payments & Payouts');
  }

  protected verify(id: string, ok: boolean): void {
    this.store.act((db, now) => adminVerifyCash(db, id, ok, now), ok ? 'Cash verified and applied to the booking.' : 'Cash rejected and reversed.');
  }

  protected payout(id: string, ok: boolean): void {
    this.store.act((db) => adminSettleLedgerEntry(db, id, ok), ok ? 'Marked as completed.' : 'Request rejected.');
  }
}
