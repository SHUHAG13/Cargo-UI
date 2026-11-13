import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Data } from '../../core/data';
import { Store } from '../../core/store';
import { Avatar } from '../../shared/avatar/avatar';

/** Operations console for CareGo+ staff: confirm bookings, assign caregivers, verify cash, pay out. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar],
  templateUrl: './admin-layout.html',
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  private readonly data = inject(Data);
  protected readonly store = inject(Store);

  /** Counts of work waiting for staff, shown as badges in the sidebar. */
  protected readonly queue = computed(() => {
    const db = this.data.db();
    return {
      bookings: db.bookings.filter((b) => b.status === 'pending' || (['confirmed', 'in-progress'].includes(b.status) && b.assigned.length === 0 && b.installments[0].paidAmount >= b.installments[0].amount - 0.005)).length,
      payments: db.payments.filter((p) => p.status === 'pending-verification').length + db.ledger.filter((l) => l.status === 'Pending Sync' && (l.kind === 'withdrawal' || l.kind === 'settle-direct')).length,
      caregivers: db.applications.filter((a) => a.status === 'pending').length,
      handovers: db.sessions.filter((s) => s.handover?.status === 'requested').length,
    };
  });

  protected readonly links = [
    { path: '/admin', label: 'Overview', icon: 'fa-gauge-high', exact: true, badge: () => this.queue().handovers },
    { path: '/admin/bookings', label: 'Bookings', icon: 'fa-calendar-check', exact: false, badge: () => this.queue().bookings },
    { path: '/admin/payments', label: 'Payments & Payouts', icon: 'fa-money-bill-transfer', exact: false, badge: () => this.queue().payments },
    { path: '/admin/caregivers', label: 'Caregivers', icon: 'fa-user-nurse', exact: false, badge: () => this.queue().caregivers },
    { path: '/admin/settings', label: 'Settings', icon: 'fa-sliders', exact: false, badge: () => 0 },
  ];
}
