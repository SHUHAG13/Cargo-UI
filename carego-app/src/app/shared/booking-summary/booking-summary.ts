import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BookingWizard } from '../../core/wizard';
import { BdtPipe } from '../../core/money.pipe';
import { FORMAT_PIPES } from '../../core/format.pipes';

/** Right-hand "Booking Summary" + "Payment Structure" panel shown on every wizard step. */
@Component({
  selector: 'app-booking-summary',
  imports: [BdtPipe, DecimalPipe, ...FORMAT_PIPES],
  templateUrl: './booking-summary.html',
  host: { class: 'block space-y-6' },
})
export class BookingSummary {
  protected readonly store = inject(BookingWizard);
}
