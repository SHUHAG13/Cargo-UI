import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-billing-overview',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './billing-overview.html',
  styleUrl: './billing-overview.css',
  host: { class: 'bg-slate-50 font-sans text-slate-800' },
})
export class BillingOverviewPage {
  constructor(title: Title) {
    title.setTitle('Payment &amp; Billing - CareGo+');
  }
}
