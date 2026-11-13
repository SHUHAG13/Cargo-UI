import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import {
  adminConfirm, adminHandover, adminReject, adminSettleLedgerEntry, adminVerifyCash, depositPaid, markMessageHandled,
} from '../../../core/domain/engine';

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, BdtPipe, ...FORMAT_PIPES],
  templateUrl: './admin-overview.html',
  host: { class: 'block' },
})
export class AdminOverviewPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);

  protected readonly pending = computed(() => this.data.db().bookings.filter((b) => b.status === 'pending'));
  protected readonly needsCrew = computed(() => this.data.db().bookings.filter((b) => ['confirmed', 'in-progress'].includes(b.status) && b.assigned.length === 0 && depositPaid(b)));
  protected readonly awaitingDeposit = computed(() => this.data.db().bookings.filter((b) => b.status === 'confirmed' && !depositPaid(b)));
  protected readonly handovers = computed(() => this.data.db().sessions.filter((s) => s.handover?.status === 'requested'));
  protected readonly cash = computed(() => this.data.db().payments.filter((p) => p.status === 'pending-verification'));
  protected readonly payouts = computed(() => this.data.db().ledger.filter((l) => l.status === 'Pending Sync' && (l.kind === 'withdrawal' || l.kind === 'settle-direct')));
  protected readonly messages = computed(() => this.data.db().messages.filter((m) => !m.handled));
  protected readonly applications = computed(() => this.data.db().applications.filter((a) => a.status === 'pending'));
  protected readonly running = computed(() => this.data.db().bookings.filter((b) => b.status === 'in-progress').length);
  protected readonly cashHeld = computed(() => this.data.db().caregivers.reduce((s, c) => s + 0, 0));

  protected readonly kpis = computed(() => [
    { label: 'Awaiting confirmation', value: this.pending().length, icon: 'fa-hourglass-half', tone: 'orange' },
    { label: 'Need caregivers', value: this.needsCrew().length, icon: 'fa-user-plus', tone: 'blue' },
    { label: 'Cash to verify', value: this.cash().length, icon: 'fa-money-bill-wave', tone: 'amber' },
    { label: 'Payout requests', value: this.payouts().length, icon: 'fa-money-bill-transfer', tone: 'purple' },
    { label: 'Handover requests', value: this.handovers().length, icon: 'fa-repeat', tone: 'rose' },
    { label: 'Services running', value: this.running(), icon: 'fa-heart-pulse', tone: 'emerald' },
  ]);

  constructor(title: Title) {
    title.setTitle('CareGo+ Admin | Overview');
  }

  protected patientName(bookingId: string): string {
    const b = this.data.booking(bookingId);
    return b ? this.data.patient(b.patientId)?.name ?? '' : '';
  }

  protected confirm(id: string): void {
    this.store.act((db, now) => adminConfirm(db, id, now), `Booking ${id} confirmed. The customer has 24 hours to pay the deposit.`);
  }

  protected decline(id: string): void {
    const reason = prompt('Reason for declining (shown to the customer):');
    if (reason) this.store.act((db, now) => adminReject(db, id, reason, now), `Booking ${id} declined.`);
  }

  protected verify(id: string, ok: boolean): void {
    this.store.act((db, now) => adminVerifyCash(db, id, ok, now), ok ? 'Cash verified and applied to the booking.' : 'Cash rejected and reversed.');
  }

  protected handover(sessionId: string, ok: boolean): void {
    this.store.act((db, now) => adminHandover(db, sessionId, ok, now), ok ? 'Handover approved.' : 'Handover declined.');
  }

  protected payout(entryId: string, ok: boolean): void {
    this.store.act((db) => adminSettleLedgerEntry(db, entryId, ok), ok ? 'Marked as paid.' : 'Request rejected.');
  }

  protected done(id: string): void {
    this.store.act((db) => markMessageHandled(db, id), 'Message marked as handled.');
  }
}
