import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { ToastService } from '../../../core/toast';
import { BdtPipe } from '../../../core/money.pipe';
import { PLATFORM_COMMISSION_RATE, SERVICE_FEE_RATE, UPFRONT_RATE, CLEARANCE_DAYS, DEPOSIT_WINDOW_HOURS, MIN_WITHDRAWAL, BASE_HOURS_PER_DAY } from '../../../core/domain/catalog';
import { updateSettings } from '../../../core/domain/engine';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, BdtPipe],
  templateUrl: './admin-settings.html',
  host: { class: 'block' },
})
export class AdminSettingsPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly toasts = inject(ToastService);

  protected limit: number = this.data.db().settings.cashLimit;
  protected readonly rules = [
    ['Service fee charged to customers', `${SERVICE_FEE_RATE * 100}% of the subtotal`],
    ['Upfront deposit', `${UPFRONT_RATE * 100}% of the total, payable within ${DEPOSIT_WINDOW_HOURS} hours of confirmation`],
    ['Platform commission on caregiver earnings', `${PLATFORM_COMMISSION_RATE * 100}% of the gross earning`],
    ['Package price basis', `Listed price is for ${BASE_HOURS_PER_DAY} hours; shorter shifts scale down proportionally`],
    ['Earning clearance', `${CLEARANCE_DAYS} days after check-out`],
    ['Minimum withdrawal', `৳${MIN_WITHDRAWAL}`],
  ];

  constructor(title: Title) {
    title.setTitle('CareGo+ Admin | Settings');
  }

  protected toggleEarly(v: boolean): void {
    this.store.act((db) => updateSettings(db, { demoEarlyCheckIn: v }), v ? 'Early check-in enabled.' : 'Check-in is now limited to the shift day.');
  }

  protected saveLimit(): void {
    this.store.act((db) => updateSettings(db, { cashLimit: Number(this.limit) }), 'Cash safety limit updated.');
  }

  protected reset(): void {
    if (confirm('Reset ALL demo data (bookings, payments, patients, caregivers) to the starting dataset? You will be signed out.')) {
      this.store.reset();
      this.toasts.info('Demo data reset. Please sign in again.');
    }
  }
}
