import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BookingService, STATUS_LABEL } from '../../../core/booking.service';
import { BdtPipe } from '../../../core/money.pipe';
import { BookingStatus } from '../../../core/models';
import { STATUS_UI } from '../my-bookings/my-bookings';

type DetailTab = 'overview' | 'payment-schedule' | 'caregiver-details' | 'service-address' | 'activity-timeline';

const HINTS: Record<BookingStatus, string> = {
  pending: 'We will notify you once your booking is confirmed.',
  confirmed: 'Pay the 30% upfront deposit within 24 hours to start the service.',
  'in-progress': 'Your caregivers are providing the service.',
  completed: 'Thank you for choosing CareGo+.',
  cancelled: 'This booking has been cancelled.',
};

/** Booking details at /app/bookings/:id with Overview / Payment Schedule / Caregiver / Address / Timeline tabs. */
@Component({
  selector: 'app-booking-details',
  imports: [RouterLink, BdtPipe],
  templateUrl: './booking-details.html',
  styleUrl: './booking-details.css',
  host: { class: 'font-sans text-slate-800' },
})
export class BookingDetailsPage {
  private readonly bookings = inject(BookingService);
  readonly id = input.required<string>();

  protected readonly ui = STATUS_UI;
  protected readonly labels = STATUS_LABEL;
  protected readonly tab = signal<DetailTab>('overview');
  protected readonly booking = computed(() => this.bookings.byId(this.id()));
  protected readonly due = computed(() => {
    const b = this.booking();
    return b ? Math.round((b.amount - b.paid) * 100) / 100 : 0;
  });
  /** Payment is only possible once admin has confirmed (never while pending/cancelled/completed). */
  protected readonly nextDue = computed(() => {
    const b = this.booking();
    if (!b || b.status === 'pending' || b.status === 'cancelled' || b.status === 'completed') return null;
    return b.installments.find((i) => i.status !== 'paid') ?? null;
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | Booking Details');
  }

  protected statusHint(s: BookingStatus): string {
    return HINTS[s];
  }

  protected cancel(id: string): void {
    if (confirm('Cancel this booking?')) this.bookings.cancel(id);
  }

  protected pay(id: string): void {
    this.bookings.payNext(id);
  }

  protected payCurrent(): void {
    const b = this.booking();
    if (b) this.pay(b.id);
  }

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }
}
