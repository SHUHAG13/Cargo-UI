import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { BookingStatus } from '../../../core/models';
import {
  adminAssign, adminConfirm, adminHandover, adminReject, adminVerifyCash, assignableCaregivers, bookingEndDate, cancelBooking, depositPaid,
  installmentState, needsAssistant, statusNote,
} from '../../../core/domain/engine';
import { INSTALLMENT_UI, PAYMENT_UI, STATUS_UI } from '../../../shared/ui';

@Component({
  selector: 'app-admin-bookings',
  imports: [RouterLink, FormsModule, BdtPipe, ...FORMAT_PIPES],
  templateUrl: './admin-bookings.html',
  host: { class: 'block' },
})
export class AdminBookingsPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  /** Route param: when present the page shows that booking's detail. */
  readonly id = input<string | undefined>(undefined);

  protected readonly ui = STATUS_UI;
  protected readonly instUi = INSTALLMENT_UI;
  protected readonly payUi = PAYMENT_UI;
  protected readonly note = statusNote;
  protected readonly end = bookingEndDate;
  protected readonly stateOf = (b: ReturnType<Data['booking']> & object, i: { seq: number }) => installmentState(b, b.installments[i.seq], this.data.today());

  protected readonly status = signal<'All' | BookingStatus>('All');
  protected readonly search = signal('');
  protected primary = '';
  protected assistant = '';

  protected readonly list = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    return this.data.db().bookings.filter((b) => {
      const p = this.data.patient(b.patientId);
      return (st === 'All' || b.status === st) && (!q || b.id.toLowerCase().includes(q) || (p?.name.toLowerCase().includes(q) ?? false));
    });
  });

  protected readonly booking = computed(() => (this.id() ? this.data.booking(this.id()!) : undefined));
  protected readonly patient = computed(() => (this.booking() ? this.data.patient(this.booking()!.patientId) : undefined));
  protected readonly owner = computed(() => this.data.db().accounts.find((a) => a.id === this.booking()?.ownerId));
  protected readonly sessions = computed(() => (this.booking() ? this.data.sessions(this.booking()!.id) : []));
  protected readonly payments = computed(() => this.data.db().payments.filter((p) => p.bookingId === this.id()).sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly timeline = computed(() => [...(this.booking()?.timeline ?? [])].sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly canAssign = computed(() => {
    const b = this.booking();
    return !!b && ['confirmed', 'in-progress'].includes(b.status) && depositPaid(b);
  });
  protected readonly wantsAssistant = computed(() => (this.booking() ? needsAssistant(this.booking()!) : false));
  protected readonly primaries = computed(() => (this.booking() ? assignableCaregivers(this.data.db(), this.booking()!, 'Primary') : []));
  protected readonly assistants = computed(() => (this.booking() ? assignableCaregivers(this.data.db(), this.booking()!, 'Assistant') : []));
  protected readonly sessionsDone = computed(() => this.sessions().filter((s) => s.status === 'completed').length);

  constructor(title: Title) {
    title.setTitle('CareGo+ Admin | Bookings');
    // Pre-select the current crew whenever a booking is opened.
    effect(() => {
      const b = this.booking();
      this.primary = b?.assigned.find((a) => a.role === 'Primary')?.caregiverId ?? '';
      this.assistant = b?.assigned.find((a) => a.role === 'Assistant')?.caregiverId ?? '';
    });
  }

  protected open(id: string): void {
    this.router.navigate(['/admin/bookings', id]);
  }

  protected confirm(): void {
    const b = this.booking();
    if (b) this.store.act((db, now) => adminConfirm(db, b.id, now), 'Booking confirmed. The customer has 24 hours to pay the deposit.');
  }

  protected decline(): void {
    const b = this.booking();
    const reason = b ? prompt('Reason for declining (shown to the customer):') : null;
    if (b && reason) this.store.act((db, now) => adminReject(db, b.id, reason, now), 'Booking declined.');
  }

  protected cancel(): void {
    const b = this.booking();
    const reason = b ? prompt('Reason for cancelling (shown to the customer):') : null;
    if (b && reason) this.store.act((db, now) => cancelBooking(db, b.id, 'admin', now, reason), 'Booking cancelled.');
  }

  protected assign(): void {
    const b = this.booking();
    if (!b) return;
    this.store.act((db, now) => adminAssign(db, b.id, this.primary, this.wantsAssistant() ? this.assistant || null : null, now), 'Care team saved. The customer can see it now.');
  }

  protected verify(id: string, ok: boolean): void {
    this.store.act((db, now) => adminVerifyCash(db, id, ok, now), ok ? 'Cash verified.' : 'Cash rejected.');
  }

  protected handover(sessionId: string, ok: boolean): void {
    this.store.act((db, now) => adminHandover(db, sessionId, ok, now), ok ? 'Handover approved.' : 'Handover declined.');
  }
}
