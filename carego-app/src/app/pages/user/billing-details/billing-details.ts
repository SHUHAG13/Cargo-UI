import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { atTime, bookingEndDate, bookingPaid, bookingPayable } from '../../../core/domain/engine';
import { PAYMENT_UI } from '../../../shared/ui';
import { PayDialog } from '../../../shared/pay-dialog/pay-dialog';
import { fmtDay } from '../../../core/domain/catalog';

/** Invoice for one booking at /app/billing/:id. Every figure comes from the booking and its payments. */
@Component({
  selector: 'app-billing-details',
  imports: [RouterLink, BdtPipe, PayDialog, ...FORMAT_PIPES],
  templateUrl: './billing-details.html',
  styleUrl: './billing-details.css',
  host: { class: 'bg-slate-50 text-slate-800' },
})
export class BillingDetailsPage {
  protected readonly data = inject(Data);
  readonly id = input.required<string>();
  protected readonly payUi = PAYMENT_UI;
  protected readonly paying = signal(false);

  protected readonly booking = computed(() => {
    const b = this.data.booking(this.id());
    return b && this.data.myBookings().some((x) => x.id === b.id) ? b : undefined;
  });
  protected readonly patient = computed(() => (this.booking() ? this.data.patient(this.booking()!.patientId) : undefined));
  protected readonly payments = computed(() => this.data.db().payments.filter((p) => p.bookingId === this.id()).sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly paid = computed(() => (this.booking() ? bookingPaid(this.booking()!) : 0));
  protected readonly payable = computed(() => (this.booking() ? bookingPayable(this.booking()!) : 0));
  protected readonly latest = computed(() => this.payments().find((p) => p.status !== 'failed') ?? this.payments()[0]);
  protected readonly crew = computed(() => (this.booking()?.assigned ?? []).map((a) => this.data.caregiver(a.caregiverId)?.name).filter(Boolean).join(', '));

  protected readonly state = computed(() => {
    const b = this.booking();
    if (!b) return { label: '', chip: '' };
    if (b.status === 'cancelled') return { label: 'Cancelled', chip: 'bg-red-100 text-red-700' };
    if (this.payable() <= 0.005 && this.data.pendingCash(b) <= 0.005) return { label: 'Paid', chip: 'bg-emerald-100 text-emerald-700' };
    return { label: this.paid() > 0 ? 'Partially paid' : 'Unpaid', chip: this.paid() > 0 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700' };
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | Invoice');
  }

  /** "10:00 AM – 10:00 PM" (the next day when the shift runs past midnight). */
  protected schedule(): string {
    const b = this.booking();
    if (!b) return '';
    const start = atTime(b.startDate, b.startTime);
    const end = new Date(start.getTime() + b.hoursPerDay * 3600000);
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${fmt(start)} – ${fmt(end)}${end.getDate() !== start.getDate() ? ' (next day)' : ''}`;
  }

  protected period(): string {
    const b = this.booking();
    return b ? `${fmtDay(b.startDate)} – ${fmtDay(bookingEndDate(b))} (${b.totalDays} Days)` : '';
  }

  protected shortAddress(addr: string): string {
    return addr.split(',').map((s) => s.trim()).slice(-2).join(', ');
  }

  protected print(): void {
    window.print();
  }
}
