import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { UserLayout } from './layouts/user-layout/user-layout';
import { CaregiverLayout } from './layouts/caregiver-layout/caregiver-layout';
import { AdminLayout } from './layouts/admin-layout/admin-layout';
import { roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', loadComponent: () => import('./pages/public/home/home').then((m) => m.HomePage) },
      { path: 'services', loadComponent: () => import('./pages/public/services/services').then((m) => m.ServicesPage) },
      { path: 'services/:tab', loadComponent: () => import('./pages/public/services/services').then((m) => m.ServicesPage) },
      { path: 'about', loadComponent: () => import('./pages/public/about/about').then((m) => m.AboutPage) },
      { path: 'contact', loadComponent: () => import('./pages/public/contact/contact').then((m) => m.ContactPage) },
      { path: 'become-caregiver', loadComponent: () => import('./pages/public/become-caregiver/become-caregiver').then((m) => m.BecomeCaregiverPage) },
      { path: 'auth/login', loadComponent: () => import('./pages/auth/login/login').then((m) => m.LoginPage) },
      { path: 'auth/register', loadComponent: () => import('./pages/auth/register/register').then((m) => m.RegisterPage) },
    ],
  },
  {
    path: 'app',
    component: UserLayout,
    canActivate: [roleGuard('user')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'bookings' },
      { path: 'dashboard', redirectTo: 'bookings' },
      { path: 'bookings', loadComponent: () => import('./pages/user/my-bookings/my-bookings').then((m) => m.MyBookingsPage) },
      { path: 'bookings/:id', loadComponent: () => import('./pages/user/booking-details/booking-details').then((m) => m.BookingDetailsPage) },
      { path: 'patients', loadComponent: () => import('./pages/user/my-patients/my-patients').then((m) => m.MyPatientsPage) },
      { path: 'patients/:id', loadComponent: () => import('./pages/user/patient-details/patient-details').then((m) => m.PatientDetailsPage) },
      { path: 'billing', loadComponent: () => import('./pages/user/billing-overview/billing-overview').then((m) => m.BillingOverviewPage) },
      { path: 'billing/:id', loadComponent: () => import('./pages/user/billing-details/billing-details').then((m) => m.BillingDetailsPage) },
      { path: 'book', loadComponent: () => import('./pages/user/booking-wizard/booking-wizard').then((m) => m.BookingWizardPage) },
      { path: 'profile', loadComponent: () => import('./pages/user/profile/profile').then((m) => m.ProfilePage) },
    ],
  },
  {
    path: 'caregiver',
    canActivate: [roleGuard('caregiver')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'schedule' },
      {
        path: '',
        component: CaregiverLayout,
        children: [
          { path: 'accounts', loadComponent: () => import('./pages/caregiver/cg-accounts/cg-accounts').then((m) => m.CgAccountsPage) },
          { path: 'earnings', loadComponent: () => import('./pages/caregiver/cg-earnings/cg-earnings').then((m) => m.CgEarningsPage) },
        ],
      },
      // Mobile-first field pages carry their own header and bottom navigation.
      { path: 'schedule', loadComponent: () => import('./pages/caregiver/cg-schedule/cg-schedule').then((m) => m.CgSchedulePage) },
      { path: 'bookings', loadComponent: () => import('./pages/caregiver/cg-bookings/cg-bookings').then((m) => m.CgBookingsPage) },
      { path: 'bookings/:id', loadComponent: () => import('./pages/caregiver/cg-booking-details/cg-booking-details').then((m) => m.CgBookingDetailsPage) },
      { path: 'shifts/:id', loadComponent: () => import('./pages/caregiver/cg-shift-details/cg-shift-details').then((m) => m.CgShiftDetailsPage) },
    ],
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', loadComponent: () => import('./pages/admin/admin-overview/admin-overview').then((m) => m.AdminOverviewPage) },
      { path: 'bookings', loadComponent: () => import('./pages/admin/admin-bookings/admin-bookings').then((m) => m.AdminBookingsPage) },
      { path: 'bookings/:id', loadComponent: () => import('./pages/admin/admin-bookings/admin-bookings').then((m) => m.AdminBookingsPage) },
      { path: 'payments', loadComponent: () => import('./pages/admin/admin-payments/admin-payments').then((m) => m.AdminPaymentsPage) },
      { path: 'caregivers', loadComponent: () => import('./pages/admin/admin-caregivers/admin-caregivers').then((m) => m.AdminCaregiversPage) },
      { path: 'settings', loadComponent: () => import('./pages/admin/admin-settings/admin-settings').then((m) => m.AdminSettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
