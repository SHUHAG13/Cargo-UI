import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Data } from '../../core/data';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast';
import { ShiftActions } from '../../core/shift-actions';
import { BdtPipe } from '../../core/money.pipe';
import { Avatar } from '../avatar/avatar';
import { findSession, requestWithdrawal, settleCash } from '../../core/domain/engine';

/** Bottom tab bar of the caregiver mobile pages. */
@Component({
  selector: 'app-cg-bottom-nav',
  imports: [RouterLink],
  template: `
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center z-50 max-w-xl mx-auto lg:hidden">
      @for (t of tabs; track t.key) {
        <a [class]="(active() === t.key ? 'text-[#0D9488]' : 'text-gray-400') + ' flex flex-col items-center gap-1'" [routerLink]="t.path">
          <i [class]="'fa-solid text-lg ' + t.icon"></i>
          <span class="text-[10px]" [class.font-bold]="active() === t.key">{{ t.label }}</span>
        </a>
      }
    </nav>
  `,
})
export class CgBottomNav {
  readonly active = input<'schedule' | 'bookings' | 'earnings' | 'accounts'>('schedule');
  protected readonly tabs = [
    { key: 'schedule', path: '/caregiver/schedule', icon: 'fa-calendar-days', label: 'Schedule' },
    { key: 'bookings', path: '/caregiver/bookings', icon: 'fa-briefcase', label: 'Bookings' },
    { key: 'earnings', path: '/caregiver/earnings', icon: 'fa-wallet', label: 'Earning' },
    { key: 'accounts', path: '/caregiver/accounts', icon: 'fa-user-gear', label: 'Account' },
  ];
}

/** Sticky top bar: brand + avatar on list pages, back link + title on detail pages. */
@Component({
  selector: 'app-cg-header',
  imports: [RouterLink, Avatar],
  template: `
    <header class="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-50 flex items-center justify-between max-w-xl mx-auto">
      @if (back()) {
        <div class="flex items-center gap-3">
          <a [routerLink]="back()" class="p-1 -ml-1 text-slate-600" aria-label="Go back"><i class="fa-solid fa-arrow-left"></i></a>
          <h1 class="text-lg font-bold text-slate-800">{{ title() }}</h1>
        </div>
      } @else {
        <div class="text-[#102C57] font-bold text-xl flex items-center">CareGo<span class="text-[#0D9488] text-2xl ml-0.5">+</span></div>
      }
      <div class="flex items-center gap-3">
        @if (auth.canSwitchTo('user')) {
          <button type="button" (click)="auth.switchRole('user')" class="text-xs font-semibold text-[#102C57] border border-gray-200 px-3 py-1.5 rounded-lg"><i class="fa-solid fa-repeat mr-1"></i>Switch to User</button>
        }
        <a routerLink="/caregiver/accounts" aria-label="Account"><app-avatar class="w-8 h-8 border border-gray-200" [photo]="auth.caregiver()?.photo" [name]="auth.account()?.name ?? ''" /></a>
      </div>
    </header>
  `,
})
export class CgHeader {
  protected readonly auth = inject(AuthService);
  readonly title = input('');
  readonly back = input<string | null>(null);
}

/** Pick who takes over a shift. Only verified, active staff who are not already on the shift are offered. */
@Component({
  selector: 'app-handover-dialog',
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/50 p-4" (click)="closed.emit()">
      <div class="bg-white rounded-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-slate-800">Request a handover</h2>
        <p class="text-xs text-slate-500 mt-1">Choose who will take over this shift. CareGo+ must approve the change.</p>
        <div class="mt-4 space-y-2 max-h-64 overflow-y-auto">
          @for (c of options(); track c.id) {
            <label [class]="(to === c.id ? 'border-[#0D9488] bg-teal-50' : 'border-slate-200') + ' flex items-center gap-3 border rounded-xl p-3 cursor-pointer'">
              <input type="radio" name="to" class="text-[#0D9488]" [value]="c.id" [(ngModel)]="to" />
              <span class="text-sm"><strong class="text-slate-800">{{ c.name }}</strong><span class="block text-[11px] text-slate-500">{{ c.kind }} · {{ c.experienceYears }} yrs · ★ {{ c.rating }}</span></span>
            </label>
          } @empty { <p class="text-sm text-slate-400">No other caregiver of this kind is available.</p> }
        </div>
        <div class="mt-5 flex gap-3">
          <button type="button" (click)="closed.emit()" class="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!to" class="flex-1 py-2.5 bg-[#0D9488] text-white rounded-lg text-sm font-bold disabled:opacity-40">Request handover</button>
        </div>
      </div>
    </div>
  `,
})
export class HandoverDialog {
  private readonly data = inject(Data);
  private readonly actions = inject(ShiftActions);
  readonly sessionId = input.required<string>();
  readonly closed = output<void>();
  protected to = '';

  protected readonly options = computed(() => {
    const db = this.data.db();
    const s = findSession(db, this.sessionId());
    if (!s) return [];
    return db.caregivers.filter((c) => c.active && c.verified && !s.attendance.some((a) => a.caregiverId === c.id));
  });

  protected submit(): void {
    if (this.to && this.actions.requestHandover(this.sessionId(), this.to)) this.closed.emit();
  }
}

/** Record cash handed over by the family. */
@Component({
  selector: 'app-cash-dialog',
  imports: [FormsModule, BdtPipe],
  template: `
    <div class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/50 p-4" (click)="closed.emit()">
      <div class="bg-white rounded-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-slate-800">Log cash received</h2>
        <p class="text-xs text-slate-500 mt-1">The family still owes <strong>{{ owed() | bdt }}</strong> on this booking. Cash you hold belongs to CareGo+ until you settle it.</p>
        <label class="block mt-4"><span class="text-xs font-bold text-slate-500">Amount received (৳)</span>
          <input type="number" min="1" [max]="owed()" step="0.01" class="mt-1 w-full border-slate-200 rounded-lg p-3 text-lg font-bold" name="cash" [(ngModel)]="amount" autofocus /></label>
        <p class="text-[11px] text-slate-400 mt-2">Cash in hand now: {{ held() | bdt }} (limit {{ limit() | bdt }}).</p>
        <div class="mt-5 flex gap-3">
          <button type="button" (click)="closed.emit()" class="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!(amount && amount > 0)" class="flex-1 py-2.5 bg-[#0D9488] text-white rounded-lg text-sm font-bold disabled:opacity-40">Record cash</button>
        </div>
      </div>
    </div>
  `,
})
export class CashDialog {
  private readonly data = inject(Data);
  private readonly actions = inject(ShiftActions);
  readonly sessionId = input.required<string>();
  readonly closed = output<void>();
  protected amount: number | null = null;

  protected readonly owed = computed(() => {
    const s = findSession(this.data.db(), this.sessionId());
    const b = s ? this.data.booking(s.bookingId) : undefined;
    return b ? this.data.payable(b) : 0;
  });
  protected readonly held = computed(() => this.data.myBalances().cashInHand);
  protected readonly limit = computed(() => this.data.db().settings.cashLimit);

  protected submit(): void {
    if (this.amount && this.actions.logCash(this.sessionId(), this.amount)) this.closed.emit();
  }
}


/** Withdraw cleared earnings to a mobile wallet. Requests are paid out by CareGo+ staff. */
@Component({
  selector: 'app-withdraw-dialog',
  imports: [FormsModule, BdtPipe],
  template: `
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4" (click)="closed.emit()">
      <div class="bg-white rounded-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-slate-800">Withdraw funds</h2>
        <p class="text-xs text-slate-500 mt-1">Available now: <strong>{{ available() | bdt }}</strong> (cleared earnings minus any cash you owe). Minimum ৳500.</p>
        <label class="block mt-4"><span class="text-xs font-bold text-slate-500">Amount (৳)</span>
          <input type="number" min="500" [max]="available()" step="1" class="mt-1 w-full border-slate-200 rounded-lg p-3 text-lg font-bold" name="wd" [(ngModel)]="amount" /></label>
        <button type="button" (click)="amount = available()" class="mt-1 text-xs font-bold text-teal-700">Withdraw everything</button>
        <p class="text-xs font-bold text-slate-500 mt-4">Pay out to</p>
        <div class="mt-2 grid grid-cols-3 gap-2">
          @for (m of methods; track m) { <button type="button" (click)="method = m" [class]="(method === m ? 'border-teal-600 bg-teal-50' : 'border-slate-200') + ' border rounded-lg py-2 text-sm font-semibold'">{{ m }}</button> }
        </div>
        <div class="mt-5 flex gap-3">
          <button type="button" (click)="closed.emit()" class="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!(amount && amount > 0)" class="flex-1 py-2.5 bg-teal-700 text-white rounded-lg text-sm font-bold disabled:opacity-40">Request withdrawal</button>
        </div>
      </div>
    </div>
  `,
})
export class WithdrawDialog {
  private readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly closed = output<void>();
  protected readonly methods = ['bKash', 'Nagad', 'Rocket'];
  protected amount: number | null = null;
  protected method = 'bKash';
  protected readonly available = computed(() => Math.max(0, this.data.myBalances().netStanding));

  protected submit(): void {
    const id = this.auth.caregiverId();
    if (!id || !this.amount) return;
    const ok = this.store.act((db, now) => { requestWithdrawal(db, id, this.amount!, this.method, now); return true; });
    if (ok) {
      this.toasts.success('Withdrawal requested. It will be paid out after CareGo+ confirms it.');
      this.closed.emit();
    }
  }
}

/** Clear cash owed to the platform: deduct from earnings, or pay directly by mobile wallet. */
@Component({
  selector: 'app-settle-dialog',
  imports: [FormsModule, BdtPipe],
  template: `
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4" (click)="closed.emit()">
      <div class="bg-white rounded-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-slate-800">{{ mode() === 'deduct' ? 'Auto-deduct from earnings' : 'Pay ' + method() + ' directly' }}</h2>
        <p class="text-xs text-slate-500 mt-1">
          You owe <strong>{{ owed() | bdt }}</strong> in cash.
          @if (mode() === 'deduct') { Your cleared earnings of <strong>{{ held() | bdt }}</strong> can cover it. }
          @else { Send the amount to CareGo+ from your {{ method() }} account; staff will confirm receipt. }
        </p>
        <label class="block mt-4"><span class="text-xs font-bold text-slate-500">Amount (৳)</span>
          <input type="number" min="1" [max]="max()" step="0.01" class="mt-1 w-full border-slate-200 rounded-lg p-3 text-lg font-bold" name="settle" [(ngModel)]="amount" /></label>
        <div class="mt-5 flex gap-3">
          <button type="button" (click)="closed.emit()" class="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!(amount && amount > 0)" class="flex-1 py-2.5 bg-teal-700 text-white rounded-lg text-sm font-bold disabled:opacity-40">Settle</button>
        </div>
      </div>
    </div>
  `,
})
export class SettleDialog {
  private readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly mode = input.required<'deduct' | 'direct'>();
  readonly method = input<string>('bKash');
  readonly closed = output<void>();
  protected readonly owed = computed(() => this.data.myBalances().cashInHand);
  protected readonly held = computed(() => Math.max(0, this.data.myBalances().digitalHeld));
  protected readonly max = computed(() => (this.mode() === 'deduct' ? Math.min(this.owed(), this.held()) : this.owed()));
  protected amount: number | null = this.defaultAmount();

  /** Start with the most that can be settled in one go. */
  private defaultAmount(): number | null {
    const b = this.data.myBalances();
    return b.cashInHand > 0 ? b.cashInHand : null;
  }

  protected submit(): void {
    const id = this.auth.caregiverId();
    if (!id || !this.amount) return;
    const ok = this.store.act((db, now) => { settleCash(db, id, this.mode(), this.amount!, this.mode() === 'direct' ? this.method() : null, now); return true; });
    if (ok) {
      this.toasts.success(this.mode() === 'deduct' ? 'Cash settled from your earnings.' : 'Payment noted. CareGo+ will confirm receipt.');
      this.closed.emit();
    }
  }
}
