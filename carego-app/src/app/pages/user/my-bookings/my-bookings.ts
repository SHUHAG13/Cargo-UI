import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BookingService, STATUS_LABEL } from '../../../core/booking.service';
import { BdtPipe } from '../../../core/money.pipe';
import { BookingStatus } from '../../../core/models';

type Filter = 'all' | BookingStatus;

/** Visual treatment per booking status (icon tile, badge, status chip). */
export const STATUS_UI: Record<BookingStatus, { icon: string; tile: string; badge: string; chip: string; paid: string }> = {
  pending: { icon: 'fa-regular fa-clock', tile: 'bg-orange-50 text-orange-400', badge: 'bg-orange-100 text-orange-600', chip: 'bg-orange-50 text-orange-600', paid: 'text-red-500' },
  confirmed: { icon: 'fa-regular fa-circle-check', tile: 'bg-green-50 text-mb-green', badge: 'bg-green-100 text-green-600', chip: 'bg-green-50 text-mb-green', paid: 'text-mb-green' },
  'in-progress': { icon: 'fa-regular fa-user', tile: 'bg-blue-50 text-blue-400', badge: 'bg-blue-100 text-blue-600', chip: 'bg-blue-50 text-blue-600', paid: 'text-mb-green' },
  completed: { icon: 'fa-regular fa-circle-check', tile: 'bg-green-50 text-mb-green', badge: 'bg-green-100 text-green-600', chip: 'bg-green-50 text-mb-green', paid: 'text-mb-green' },
  cancelled: { icon: 'fa-regular fa-circle-xmark', tile: 'bg-red-50 text-red-400', badge: 'bg-red-100 text-red-600', chip: 'bg-red-50 text-red-500', paid: 'text-red-500' },
};

@Component({
  selector: 'app-my-bookings',
  imports: [RouterLink, BdtPipe],
  templateUrl: './my-bookings.html',
  styleUrl: './my-bookings.css',
  host: { class: 'flex h-screen overflow-hidden' },
})
export class MyBookingsPage {
  protected readonly bookings = inject(BookingService);
  protected readonly ui = STATUS_UI;
  protected readonly labels = STATUS_LABEL;
  protected readonly filter = signal<Filter>('all');
  protected readonly tabs: { key: Filter; label: string; badge: string }[] = [
    { key: 'all', label: 'All Bookings', badge: '' },
    { key: 'pending', label: 'Pending', badge: 'bg-orange-100 text-orange-600' },
    { key: 'confirmed', label: 'Confirmed', badge: 'bg-green-100 text-green-600' },
    { key: 'in-progress', label: 'In Progress', badge: 'bg-blue-100 text-blue-600' },
    { key: 'completed', label: 'Completed', badge: 'bg-gray-100 text-gray-600' },
    { key: 'cancelled', label: 'Cancelled', badge: 'bg-red-100 text-red-600' },
  ];
  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.bookings.bookings() : this.bookings.bookings().filter((b) => b.status === f);
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ - My Bookings');
  }
}
