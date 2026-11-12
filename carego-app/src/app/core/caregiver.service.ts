import { computed, Injectable, signal } from '@angular/core';
import { CaregiverShift, EarningRow, LedgerEntry } from './models';
import { PLATFORM_COMMISSION_RATE } from './catalog.service';

/** Caregiver portal demo data (Afia Islam). */
@Injectable({ providedIn: 'root' })
export class CaregiverService {
  readonly profile = { name: 'Afia Islam', role: 'Caregiver', hourlyRate: 500 };

  readonly shifts = signal<CaregiverShift[]>([
    {
      bookingId: 'BK-2026-0604-001', packageId: 'CGP-992', service: 'Home Nursing', patient: 'Mrs. Tahmina Begum', age: 68,
      diagnosis: 'Post Stroke Care', address: 'House 12, Road 5, Dhanmondi, Dhaka 1205', date: 'Thu, Jun 4 2026',
      start: '08:00 AM', end: '08:00 PM', hours: 12, status: 'Active', checkedInAt: '08:02 AM', coPresentWith: 'Rupa A.', handoverTo: 'Shazid Ahmed',
    },
    {
      bookingId: 'BK-2026-0605-002', packageId: 'CGP-992', service: 'Home Nursing', patient: 'Mrs. Tahmina Begum', age: 68,
      diagnosis: 'Post Stroke Care', address: 'House 12, Road 5, Dhanmondi, Dhaka 1205', date: 'Fri, Jun 5 2026',
      start: '08:00 AM', end: '08:00 PM', hours: 12, status: 'Upcoming',
    },
    {
      bookingId: 'BK-2026-0607-004', packageId: 'CGP-992', service: 'Home Nursing', patient: 'Mrs. Tahmina Begum', age: 68,
      diagnosis: 'Post Stroke Care', address: 'House 12, Road 5, Dhanmondi, Dhaka 1205', date: 'Sun, Jun 7 2026',
      start: '08:00 AM', end: '08:00 PM', hours: 12, status: 'Upcoming',
    },
  ]);

  /** Session state for the active shift. */
  readonly checkedIn = signal(true);
  readonly checkedOutAt = signal<string | null>(null);
  readonly cashLogged = signal(0);
  readonly shiftNotes = signal<{ text: string; at: string }[]>([]);

  readonly earnings = signal<EarningRow[]>([
    row('Jun 04, 2026', 'Caregiver Service', 'BK-2026-0604-001', '24 Hours', 3500, 'Completed'),
    row('Jun 02, 2026', 'Senior Home Support', 'BK-2026-0602-014', '12 Hours', 1800, 'Completed'),
    row('May 28, 2026', 'Post-Surgery Care', 'BK-2026-0528-092', '30 Days', 45000, 'Withdrawn'),
    row('Jun 06, 2026', 'Emergency Night Shift', 'BK-2026-0606-102', '8 Hours', 2000, 'Pending'),
  ]);
  readonly earningsTotal = 28;
  readonly monthly = [{ m: 'JAN', v: 18 }, { m: 'FEB', v: 22 }, { m: 'MAR', v: 28 }, { m: 'APR', v: 26 }, { m: 'MAY', v: 32 }, { m: 'JUN', v: 34.2 }];

  readonly availableToWithdraw = signal(12500);
  readonly pendingClearance = signal(4830);
  readonly monthTotal = signal(34200);

  /** Accounts & Ledger: cash the caregiver holds for the platform vs. digital earnings held for them. */
  readonly cashInHand = signal(4200);
  readonly digitalEarnings = signal(14500);
  readonly netStanding = computed(() => this.digitalEarnings() - this.cashInHand());

  readonly ledger = signal<LedgerEntry[]>([
    { date: 'Oct 24, 2023', time: '14:20 PM', description: 'Home Care Visit - Mr. Kamal', ref: '#CG-BOK-99231', flow: 'Cash Collected', debit: 1500, credit: null, balance: 8800, status: 'Reconciled' },
    { date: 'Oct 23, 2023', time: '09:15 AM', description: 'Digital Payout to bKash', ref: '#CG-PAY-11002', flow: 'Withdrawal', debit: 5000, credit: null, balance: 10300, status: 'Pending Sync' },
    { date: 'Oct 22, 2023', time: '18:45 PM', description: 'Platform Commission Adj.', ref: '#CG-ADJ-2210', flow: 'Internal Flow', debit: 450, credit: null, balance: 15300, status: 'Settled' },
    { date: 'Oct 22, 2023', time: '11:00 AM', description: 'Digital Booking: Mrs. Rahima', ref: '#CG-BOK-99182', flow: 'Digital Credit', debit: null, credit: 2800, balance: 14850, status: 'Reconciled' },
  ]);

  checkOut(): void {
    this.checkedOutAt.set(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    this.checkedIn.set(false);
  }

  logCash(amount: number): void {
    if (amount > 0) this.cashLogged.update((c) => c + amount);
  }

  addNote(text: string): void {
    const t = text.trim();
    if (t) this.shiftNotes.update((n) => [{ text: t, at: new Date().toLocaleString('en-GB') }, ...n]);
  }

  /** Settle platform cash owed by deducting from held digital earnings. */
  settleFromEarnings(): void {
    const owed = this.cashInHand();
    this.digitalEarnings.update((d) => d - owed);
    this.cashInHand.set(0);
  }

  withdraw(): void {
    this.availableToWithdraw.set(0);
  }
}

function row(date: string, service: string, bookingId: string, duration: string, gross: number, status: EarningRow['status']): EarningRow {
  const fee = Math.round(gross * PLATFORM_COMMISSION_RATE * 100) / 100;
  return { date, service, bookingId, duration, gross, fee, net: gross - fee, status };
}
