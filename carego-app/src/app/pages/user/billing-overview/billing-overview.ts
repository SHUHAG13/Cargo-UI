import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { ToastService } from '../../../core/toast';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { Booking, Payment } from '../../../core/models';
import {
  addSavedMethod, bookingDue, bookingEndDate, bookingPaid, bookingPayable, DomainError, installmentState, isPayable, nextInstallment, removeSavedMethod,
} from '../../../core/domain/engine';
import { fmtDay } from '../../../core/domain/catalog';
import { PAYMENT_UI } from '../../../shared/ui';
import { PayDialog } from '../../../shared/pay-dialog/pay-dialog';

const PAGE = 5;

@Component({
  selector: 'app-billing-overview',
  imports: [RouterLink, FormsModule, BdtPipe, PayDialog, ...FORMAT_PIPES],
  templateUrl: './billing-overview.html',
  styleUrl: './billing-overview.css',
  host: { class: 'bg-slate-50 font-sans text-slate-800' },
})
export class BillingOverviewPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly payUi = PAYMENT_UI;
  protected readonly payingId = signal<string | null>(null);
  protected readonly showAdd = signal(false);
  protected methodType: 'bKash' | 'Nagad' | 'Visa Card' | 'Mastercard' = 'bKash';
  protected methodNumber = '';
  protected readonly methodError = signal('');

  protected readonly serviceFilter = signal('All Services');
  protected readonly statusFilter = signal('All Statuses');
  protected readonly shown = signal(PAGE);

  /** Bookings that still involve money: anything confirmed or running, or finished with a balance. */
  protected readonly activeServices = computed(() =>
    this.data.myBookings().filter((b) => isPayable(b) && (b.status !== 'completed' || bookingPayable(b) > 0.005 || this.data.pendingCash(b) > 0)));

  protected readonly services = computed(() => ['All Services', ...new Set(this.data.myBookings().map((b) => b.categoryName))]);

  protected readonly transactions = computed(() => {
    const sf = this.serviceFilter();
    const st = this.statusFilter();
    return this.data.myPayments().filter((p) => {
      const b = this.data.booking(p.bookingId);
      return (sf === 'All Services' || b?.categoryName === sf)
        && (st === 'All Statuses' || PAYMENT_UI[p.status].label === st);
    });
  });

  protected readonly summary = computed(() => {
    const d = this.data.now();
    const mine = this.data.myPayments().filter((p) => {
      const t = new Date(p.at);
      return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
    });
    const live = this.data.myBookings().filter((b) => b.status !== 'cancelled');
    return {
      paid: Math.round(mine.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0) * 100) / 100,
      outstanding: Math.round(live.reduce((s, b) => s + (b.status === 'pending' ? 0 : bookingDue(b)), 0) * 100) / 100,
      success: mine.filter((p) => p.status === 'success').length,
      failed: mine.filter((p) => p.status === 'failed').length,
    };
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | Payment & Billing');
  }

  protected bookingOf(p: Payment): Booking | undefined {
    return this.data.booking(p.bookingId);
  }

  protected title(b: Booking): string {
    return `${b.categoryName} – ${b.totalDays}-Day Package`;
  }

  protected patientName(b: Booking): string {
    return this.data.patient(b.patientId)?.name ?? '';
  }

  /** What the "Next Payment" row shows for a service. */
  protected next(b: Booking): { date: string; amount: number; label: string; chip: string; payable: boolean } {
    const i = nextInstallment(b);
    if (!i) {
      return { date: '—', amount: 0, label: this.data.pendingCash(b) > 0 ? 'Pending verification' : 'Paid', chip: this.data.pendingCash(b) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600', payable: false };
    }
    const st = installmentState(b, i, this.data.today());
    const remaining = Math.round((i.amount - i.paidAmount - i.pendingAmount) * 100) / 100;
    return {
      date: i.dueDate ? fmtDay(i.dueDate) : 'On confirmation', amount: remaining,
      label: st === 'overdue' ? 'Overdue' : st === 'due' ? 'Due' : 'Upcoming',
      chip: st === 'overdue' ? 'bg-red-50 text-red-600' : st === 'due' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600',
      payable: true,
    };
  }

  protected period(b: Booking): string {
    return `${fmtDay(b.startDate)} – ${fmtDay(bookingEndDate(b))}`;
  }

  protected paid = bookingPaid;

  protected methodBrand(type: string): { bg: string; letter: string } {
    return type === 'bKash' ? { bg: 'bg-pink-500', letter: 'b' } : type === 'Nagad' ? { bg: 'bg-orange-500', letter: 'N' }
      : type.startsWith('Visa') ? { bg: 'bg-blue-700', letter: 'V' } : { bg: 'bg-red-600', letter: 'M' };
  }

  protected addMethod(): void {
    const owner = this.auth.account()?.id ?? '';
    try {
      this.store.actOrThrow((db) => addSavedMethod(db, owner, this.methodType, this.methodNumber));
      this.toasts.success(`${this.methodType} saved.`);
      this.methodNumber = '';
      this.methodError.set('');
      this.showAdd.set(false);
    } catch (e) {
      this.methodError.set(e instanceof DomainError ? e.message : 'Could not save this method.');
    }
  }

  protected removeMethod(id: string): void {
    const owner = this.auth.account()?.id ?? '';
    if (confirm('Remove this saved payment method?')) this.store.act((db) => removeSavedMethod(db, owner, id), 'Payment method removed.');
  }

  protected invoice(bookingId: string): void {
    this.router.navigate(['/app/billing', bookingId]);
  }
}
