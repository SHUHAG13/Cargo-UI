import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-billing-details',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './billing-details.html',
  styleUrl: './billing-details.css',
  host: { class: 'bg-slate-50 text-slate-800' },
})
export class BillingDetailsPage {
  constructor(title: Title) {
    title.setTitle('Payment &amp; Billing Details - CareGo+');
  }
}
