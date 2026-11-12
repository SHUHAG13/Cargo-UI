import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-cg-bookings',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cg-bookings.html',
  styleUrl: './cg-bookings.css',
  host: { class: 'pb-20' },
})
export class CgBookingsPage {
  constructor(title: Title) {
    title.setTitle('CareGo+ Bookings Dashboard');
  }
}
