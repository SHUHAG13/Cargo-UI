import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Avatar } from '../../shared/avatar/avatar';

/** Caregiver portal shell: sidebar on desktop, bottom tab bar on mobile. */
@Component({
  selector: 'app-caregiver-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar],
  templateUrl: './caregiver-layout.html',
  host: { class: 'bg-cg-surface text-cg-text-main antialiased overflow-x-hidden' },
})
export class CaregiverLayout {
  protected readonly auth = inject(AuthService);
  protected readonly mobileLinks = [
    { path: '/caregiver/schedule', icon: 'fa-calendar-days', label: 'Schedule' },
    { path: '/caregiver/bookings', icon: 'fa-briefcase', label: 'Bookings' },
    { path: '/caregiver/earnings', icon: 'fa-wallet', label: 'Earning' },
    { path: '/caregiver/accounts', icon: 'fa-user-gear', label: 'Account' },
  ];
  protected readonly links = [
    { path: '/caregiver/schedule', icon: 'calendar_today', label: 'Schedule' },
    { path: '/caregiver/bookings', icon: 'assignment', label: 'Bookings' },
    { path: '/caregiver/earnings', icon: 'payments', label: 'Earnings' },
    { path: '/caregiver/accounts', icon: 'account_balance_wallet', label: 'Accounts & Ledger' },
    { path: '/contact', icon: 'contact_support', label: 'Support' },
  ];
}
