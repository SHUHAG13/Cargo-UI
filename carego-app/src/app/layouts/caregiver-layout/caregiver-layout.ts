import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Caregiver desktop portal shell (Earnings, Accounts & Ledger). */
@Component({
  selector: 'app-caregiver-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './caregiver-layout.html',
  host: { class: 'bg-cg-surface text-cg-text-main antialiased overflow-x-hidden' },
})
export class CaregiverLayout {}
