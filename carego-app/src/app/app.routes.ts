import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { UserLayout } from './layouts/user-layout/user-layout';
import { CaregiverLayout } from './layouts/caregiver-layout/caregiver-layout';

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
      { path: 'auth/login', loadComponent: () => import('./pages/auth/login/login').then((m) => m.LoginPage) },
      { path: 'auth/register', loadComponent: () => import('./pages/auth/register/register').then((m) => m.RegisterPage) },
    ],
  },
  {
    path: 'app',
    component: UserLayout,
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
    ],
  },
  {
    path: 'caregiver',
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
  { path: '**', redirectTo: '' },
];
