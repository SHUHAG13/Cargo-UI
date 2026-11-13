import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Data } from '../../core/data';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast';
import { BdtPipe } from '../../core/money.pipe';
import { PayMethod } from '../../core/models';
import { bookingPayable, isValidBdMobile, makePayment, nextInstallment } from '../../core/domain/engine';
import { round2 } from '../../core/domain/catalog';

type AmountMode = 'next' | 'all' | 'custom';

const luhn = (num: string): boolean => {
  const d = num.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(d)) return false;
  let sum = 0;
  [...d].reverse().forEach((ch, i) => {
    let n = Number(ch);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  });
  return sum % 10 === 0;
};

/** Modal payment sheet. Wallets and cards are simulated; use card 4000 0000 0000 0002 to see a declined payment. */
@Component({
  selector: 'app-pay-dialog',
  imports: [FormsModule, BdtPipe],
  templateUrl: './pay-dialog.html',
})
export class PayDialog {
  private readonly store = inject(Store);
  private readonly toasts = inject(ToastService);
  protected readonly data = inject(Data);

  readonly bookingId = input.required<string>();
  readonly closed = output<void>();

  protected readonly booking = computed(() => this.data.booking(this.bookingId()));
  protected readonly nextI = computed(() => {
    const b = this.booking();
    return b ? nextInstallment(b) : undefined;
  });
  protected readonly nextAmount = computed(() => {
    const i = this.nextI();
    return i ? round2(i.amount - i.paidAmount - i.pendingAmount) : 0;
  });
  protected readonly payable = computed(() => {
    const b = this.booking();
    return b ? bookingPayable(b) : 0;
  });

  protected readonly mode = signal<AmountMode>('next');
  protected customAmount: number | null = null;
  protected readonly method = signal<PayMethod>('bKash');
  protected readonly savedId = signal<string | null>(null);
  protected mobile = '';
  protected cardNumber = '';
  protected expiry = '';
  protected cvc = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly methods: { id: PayMethod; label: string; icon: string; hint: string }[] = [
    { id: 'bKash', label: 'bKash', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Nagad', label: 'Nagad', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Rocket', label: 'Rocket', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Card', label: 'Card', icon: 'fa-regular fa-credit-card', hint: 'Visa / Mastercard (SSLCommerz)' },
    { id: 'Cash to Staff', label: 'Cash to Staff', icon: 'fa-solid fa-hand-holding-dollar', hint: 'Verified by CareGo+' },
  ];

  protected readonly amount = computed(() => {
    switch (this.mode()) {
      case 'all': return this.payable();
      case 'custom': return round2(this.customAmount ?? 0);
      default: return this.nextAmount();
    }
  });

  protected pickSaved(id: string, type: string): void {
    this.savedId.set(id);
    this.method.set(type.includes('Card') ? 'Card' : (type as PayMethod));
    this.error.set('');
  }

  protected pickMethod(m: PayMethod): void {
    this.method.set(m);
    this.savedId.set(null);
    this.error.set('');
  }

  protected submit(): void {
    const b = this.booking();
    if (!b) return;
    this.error.set('');
    const amount = this.amount();
    if (!(amount > 0)) return this.error.set('Enter an amount greater than zero.');
    if (amount - this.payable() > 0.005) return this.error.set(`The most you can pay is ${this.payable().toLocaleString('en-IN')} BDT.`);

    const m = this.method();
    let reference: string | undefined;
    const saved = this.savedId() ? this.data.myMethods().find((s) => s.id === this.savedId()) : null;
    let declined = false;
    if (saved) {
      reference = saved.masked;
    } else if (m === 'bKash' || m === 'Nagad' || m === 'Rocket') {
      if (!isValidBdMobile(this.mobile)) return this.error.set(`Enter the ${m} mobile number you will pay from (e.g. 01712345678).`);
      const n = this.mobile.replace(/\D/g, '').slice(-11);
      reference = `${n.slice(0, 4)}***${n.slice(-3)}`;
    } else if (m === 'Card') {
      if (!luhn(this.cardNumber)) return this.error.set('That card number is not valid.');
      const m2 = /^(\d{2})\s*\/\s*(\d{2})$/.exec(this.expiry.trim());
      const now = new Date();
      if (!m2 || Number(m2[1]) < 1 || Number(m2[1]) > 12 || Number(`20${m2[2]}`) * 12 + Number(m2[1]) < now.getFullYear() * 12 + now.getMonth() + 1) {
        return this.error.set('Enter a valid expiry date (MM/YY) that has not passed.');
      }
      if (!/^\d{3,4}$/.test(this.cvc)) return this.error.set('Enter the 3 or 4 digit security code.');
      const digits = this.cardNumber.replace(/\s/g, '');
      reference = `**** ${digits.slice(-4)}`;
      declined = digits === '4000000000000002';
    }

    this.busy.set(true);
    const pay = this.store.act((db, now) =>
      makePayment(db, { bookingId: b.id, method: m, amount, reference, simulateOutcome: declined ? 'declined' : 'success' }, now));
    this.busy.set(false);
    if (!pay) return;
    if (pay.status === 'failed') {
      this.toasts.error('The payment was declined. Try another card or method.');
      return;
    }
    this.toasts.success(pay.status === 'pending-verification'
      ? 'Cash payment recorded. CareGo+ will verify it shortly.'
      : `Payment of ৳${pay.amount.toLocaleString('en-IN')} received. Thank you!`);
    this.closed.emit();
  }
}
