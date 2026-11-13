import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { Booking, TimelineEvent } from '../../../core/models';
import {
  bookingEndDate, cancelBooking, depositPaid, installmentState, isPayable, nextInstallment, paidPercent, statusHint, statusNote,
  updateBookingLogistics, bookingPayable,
} from '../../../core/domain/engine';
import { CONSENT_SECTIONS } from '../../../core/domain/consent';
import { INSTALLMENT_UI, PAYMENT_UI, STATUS_UI } from '../../../shared/ui';
import { Avatar } from '../../../shared/avatar/avatar';
import { PayDialog } from '../../../shared/pay-dialog/pay-dialog';
import { addDays } from '../../../core/domain/catalog';

type DetailTab = 'overview' | 'payment-schedule' | 'caregiver-details' | 'service-address' | 'activity-timeline';

interface Step {
  title: string;
  text: string;
  at?: string;
  amount?: number;
  done: boolean;
  icon: 'check' | 'card' | 'team' | 'flag' | 'clock';
}

/** Booking details at /app/bookings/:id with Overview / Payment Schedule / Caregiver / Address / Timeline tabs. */
@Component({
  selector: 'app-booking-details',
  imports: [RouterLink, FormsModule, BdtPipe, Avatar, PayDialog, ...FORMAT_PIPES],
  templateUrl: './booking-details.html',
  styleUrl: './booking-details.css',
  host: { class: 'font-sans text-slate-800' },
})
export class BookingDetailsPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly data = inject(Data);
  readonly id = input.required<string>();

  protected readonly ui = STATUS_UI;
  protected readonly instUi = INSTALLMENT_UI;
  protected readonly payUi = PAYMENT_UI;
  protected readonly consent = CONSENT_SECTIONS;
  protected readonly note = statusNote;
  protected readonly hint = statusHint;
  protected readonly pct = paidPercent;
  protected readonly end = bookingEndDate;
  protected readonly stateOf = (b: Booking, i: Booking['installments'][number]) => installmentState(b, i, this.data.today());

  protected readonly tab = signal<DetailTab>('overview');
  protected readonly paying = signal(false);
  protected readonly showConsent = signal(false);
  protected readonly editing = signal<'address' | 'instructions' | 'backup' | null>(null);

  protected addressDraft = '';
  protected instructionsDraft = '';
  protected backupDraft = { name: '', relation: '', mobile: '' };
  protected readonly formError = signal('');

  protected readonly booking = computed(() => this.data.booking(this.id()));
  protected readonly patient = computed(() => {
    const b = this.booking();
    return b ? this.data.patient(b.patientId) : undefined;
  });
  protected readonly due = computed(() => {
    const b = this.booking();
    return b ? this.data.due(b) : 0;
  });
  protected readonly paid = computed(() => {
    const b = this.booking();
    return b ? this.data.paid(b) : 0;
  });
  protected readonly pendingCash = computed(() => {
    const b = this.booking();
    return b ? this.data.pendingCash(b) : 0;
  });
  /** The next instalment the customer can pay right now (never while pending, cancelled or fully paid). */
  protected readonly nextDue = computed(() => {
    const b = this.booking();
    if (!b || !isPayable(b) || bookingPayable(b) <= 0.005) return null;
    return nextInstallment(b) ?? null;
  });
  protected readonly nextAmount = computed(() => {
    const i = this.nextDue();
    return i ? Math.round((i.amount - i.paidAmount - i.pendingAmount) * 100) / 100 : 0;
  });
  protected readonly canCancel = computed(() => {
    const b = this.booking();
    return !!b && (b.status === 'pending' || b.status === 'confirmed');
  });
  protected readonly hoursLeft = computed(() => {
    const b = this.booking();
    if (!b?.depositDueBy || depositPaid(b) || b.status !== 'confirmed') return null;
    const ms = new Date(b.depositDueBy).getTime() - this.data.now().getTime();
    return Math.max(0, Math.ceil(ms / 3600000));
  });
  protected readonly crew = computed(() => {
    const b = this.booking();
    return (b?.assigned ?? []).map((a) => ({ ...a, c: this.data.caregiver(a.caregiverId) })).filter((x) => !!x.c);
  });
  protected readonly payments = computed(() => this.data.db().payments.filter((p) => p.bookingId === this.id()).sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly sessionsDone = computed(() => this.data.done(this.id()));
  protected readonly activity = computed<TimelineEvent[]>(() => [...(this.booking()?.timeline ?? [])].sort((a, b) => b.at.localeCompare(a.at)));

  /** The seven canonical lifecycle milestones, each with its real timestamp once it has happened. */
  protected readonly steps = computed<Step[]>(() => {
    const b = this.booking();
    if (!b) return [];
    const ev = (pred: (e: TimelineEvent) => boolean) => b.timeline.find(pred);
    const placed = ev((e) => e.kind === 'placed');
    const conf = ev((e) => e.kind === 'confirmed');
    const dep = ev((e) => e.title === 'Payment Received (30%)');
    const asg = ev((e) => e.kind === 'assigned');
    const start = ev((e) => e.kind === 'started');
    const end = ev((e) => e.kind === 'completed');
    const dead = b.status === 'cancelled';
    return [
      { title: 'Booking Placed', text: 'Your booking request has been placed successfully.', at: placed?.at, done: true, icon: 'check' },
      { title: 'Booking Confirmed', text: 'Your booking has been confirmed by CareGo+.', at: conf?.at, done: !!conf, icon: 'check' },
      { title: 'Payment Received (30%)', text: '30% upfront down-payment has been received.', at: dep?.at, amount: dep?.amount ?? (dep ? b.breakdown.upfront : undefined), done: !!dep, icon: 'card' },
      { title: 'Caregiver(s) Assigned', text: asg?.text ?? 'Your primary and assistant caregivers will be assigned once the deposit is received.', at: asg?.at, done: !!asg, icon: 'team' },
      { title: 'Service Started', text: start ? start.text : dead ? 'The service never started.' : 'This will be updated once your service starts.', at: start?.at, done: !!start, icon: 'flag' },
      { title: 'Service Ended', text: end ? end.text : dead ? 'This booking was cancelled.' : 'This will be updated once the service is completed.', at: end?.at, done: !!end, icon: 'flag' },
    ];
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | Booking Details');
  }

  protected cancel(): void {
    const b = this.booking();
    if (!b || !confirm('Cancel this booking? This cannot be undone.')) return;
    this.store.act((db, now) => cancelBooking(db, b.id, 'customer', now), 'Your booking has been cancelled.');
  }

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  protected viewInvoice(): void {
    this.router.navigate(['/app/billing', this.id()]);
  }

  protected startEdit(which: 'address' | 'instructions' | 'backup'): void {
    const b = this.booking();
    if (!b) return;
    this.formError.set('');
    this.addressDraft = b.serviceAddress;
    this.instructionsDraft = b.instructions.join('\n');
    this.backupDraft = { name: b.backupContact?.name ?? '', relation: b.backupContact?.relation ?? '', mobile: b.backupContact?.mobile ?? '' };
    this.editing.set(which);
  }

  protected saveEdit(): void {
    const b = this.booking();
    const which = this.editing();
    if (!b || !which) return;
    try {
      this.store.actOrThrow((db) => updateBookingLogistics(db, b.id,
        which === 'address' ? { serviceAddress: this.addressDraft }
          : which === 'instructions' ? { instructions: this.instructionsDraft.split('\n') }
            : { backupContact: this.backupDraft }));
      this.editing.set(null);
    } catch (e) {
      this.formError.set(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  protected deadline(b: Booking): string {
    return b.depositDueBy ?? addDays(b.startDate, 0);
  }
}
