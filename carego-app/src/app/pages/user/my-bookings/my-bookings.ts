import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { BookingStatus } from '../../../core/models';
import { paidPercent, statusNote } from '../../../core/domain/engine';
import { STATUS_UI } from '../../../shared/ui';

type Filter = 'all' | BookingStatus;

@Component({
  selector: 'app-my-bookings',
  imports: [RouterLink, BdtPipe, ...FORMAT_PIPES],
  templateUrl: './my-bookings.html',
  styleUrl: './my-bookings.css',
  host: { class: 'flex h-screen overflow-hidden' },
})
export class MyBookingsPage {
  protected readonly data = inject(Data);
  protected readonly ui = STATUS_UI;
  protected readonly note = statusNote;
  protected readonly pct = paidPercent;
  protected readonly filter = signal<Filter>('all');
  protected readonly tabs: { key: Filter; label: string; badge: string }[] = [
    { key: 'all', label: 'All Bookings', badge: '' },
    { key: 'pending', label: 'Pending', badge: 'bg-orange-100 text-orange-600' },
    { key: 'confirmed', label: 'Confirmed', badge: 'bg-green-100 text-green-600' },
    { key: 'in-progress', label: 'In Progress', badge: 'bg-blue-100 text-blue-600' },
    { key: 'completed', label: 'Completed', badge: 'bg-gray-100 text-gray-600' },
    { key: 'cancelled', label: 'Cancelled', badge: 'bg-red-100 text-red-600' },
  ];
  protected readonly counts = computed(() => {
    const c: Record<BookingStatus, number> = { pending: 0, confirmed: 0, 'in-progress': 0, completed: 0, cancelled: 0 };
    for (const b of this.data.myBookings()) c[b.status]++;
    return c;
  });
  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.data.myBookings().filter((b) => f === 'all' || b.status === f);
  });
  protected readonly needsPayment = computed(() => this.data.myBookings().filter((b) => b.status === 'confirmed' && b.installments[0].paidAmount < b.installments[0].amount - 0.005).length);

  constructor(title: Title) {
    title.setTitle('CareGo+ - My Bookings');
  }
}
