import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

type CgTab = 'responsibilities' | 'medical' | 'profile' | 'careplan' | 'payment';

@Component({
  selector: 'app-cg-booking-details',
  imports: [RouterLink],
  templateUrl: './cg-booking-details.html',
  styleUrl: './cg-booking-details.css',
  host: { class: 'pb-20' },
})
export class CgBookingDetailsPage {
  protected readonly tab = signal<CgTab>('responsibilities');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Booking Details');
  }

  protected selectTab(t: CgTab, e: Event): void {
    this.tab.set(t);
    (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}
