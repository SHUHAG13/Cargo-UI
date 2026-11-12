import { Injectable, signal } from '@angular/core';
import { ActiveService, PaymentMethod, Transaction } from './models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  readonly methods = signal<PaymentMethod[]>([
    { id: 'm1', type: 'bKash', masked: '0187 **** 2468' },
    { id: 'm2', type: 'Nagad', masked: '0171 **** 1357' },
    { id: 'm3', type: 'Visa Card', masked: '**** **** **** 4242' },
    { id: 'm4', type: 'Mastercard', masked: '**** **** **** 8888' },
  ]);

  readonly activeServices = signal<ActiveService[]>([
    { id: 'CGP-99281', title: 'Home Nursing – 30-Day Package', subject: 'Patient: Abdul Karim (Father)', nextPayment: '25 May 2025', amount: 5600, status: 'Paid', period: '18 May – 16 Jun 2025' },
    { id: 'CGP-96210', title: 'Physiotherapy – 15-Day Package', subject: 'Patient: Mehedi Hasan', nextPayment: '1 Jun 2025', amount: 4200, status: 'Upcoming', period: '18 May – 1 Jun 2025' },
    { id: 'CGP-97122', title: 'Nanny Service – 10-Day Package', subject: 'Patient: Safiya (Child)', nextPayment: '10 May 2025', amount: 2500, status: 'Pending', period: '1 May – 10 May 2025' },
    { id: 'CGP-99301', title: 'Cleaning Service – Standard', subject: 'Location: Banani, Dhaka', nextPayment: '15 May 2025', amount: 2000, status: 'Completed', period: 'Service Date 14 May 2025' },
  ]);

  readonly transactions = signal<Transaction[]>([
    { id: '#CGP-99281-03', date: '24 May 2025', time: '10:15 AM', service: 'Home Nursing', pkg: '30-Day Package', method: 'Cash to Staff', amount: 5600, status: 'Pending Verification' },
    { id: '#CGP-99281-01', date: '18 May 2025', time: '02:30 PM', service: 'Home Nursing', pkg: '30-Day Package', method: 'SSLCommerz (Card)', amount: 2800, status: 'Success' },
    { id: '#CGP-96210-02', date: '12 May 2025', time: '11:20 AM', service: 'Physiotherapy', pkg: '15-Day Package', method: 'bKash', amount: 4200, status: 'Success' },
    { id: '#CGP-96210-01', date: '12 May 2025', time: '09:05 AM', service: 'Physiotherapy', pkg: '15-Day Package', method: 'Nagad', amount: 1800, status: 'Success' },
    { id: '#CGP-97122-01', date: '05 May 2025', time: '04:45 PM', service: 'Nanny Service', pkg: '10-Day Package', method: 'SSLCommerz (Card)', amount: 2500, status: 'Failed / Disputed' },
  ]);

  readonly monthTotals = signal({ paid: 13200, outstanding: 16800, successful: 3 });

  payActiveService(id: string): void {
    this.activeServices.update((l) => l.map((s) => s.id === id ? { ...s, status: 'Paid' } : s));
  }
}
