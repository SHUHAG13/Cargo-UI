import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BookingStore } from '../../core/booking-store';
import { BdtPipe } from '../../core/money.pipe';

/** Right-hand "Booking Summary" + "Payment Structure" panel shown on every wizard step. */
@Component({
  selector: 'app-booking-summary',
  imports: [BdtPipe, DecimalPipe],
  templateUrl: './booking-summary.html',
  host: { class: 'block space-y-6' },
})
export class BookingSummary {
  protected readonly store = inject(BookingStore);
}
