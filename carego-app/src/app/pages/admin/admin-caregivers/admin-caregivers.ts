import { Component, computed, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { balances, decideApplication, setCaregiverActive } from '../../../core/domain/engine';
import { Avatar } from '../../../shared/avatar/avatar';

@Component({
  selector: 'app-admin-caregivers',
  imports: [BdtPipe, Avatar, ...FORMAT_PIPES],
  templateUrl: './admin-caregivers.html',
  host: { class: 'block' },
})
export class AdminCaregiversPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);

  protected readonly pending = computed(() => this.data.db().applications.filter((a) => a.status === 'pending'));
  protected readonly decided = computed(() => this.data.db().applications.filter((a) => a.status !== 'pending').slice(0, 5));
  protected readonly staff = computed(() => this.data.db().caregivers.map((c) => ({
    c, b: balances(this.data.db(), c.id, this.data.now()),
    jobs: this.data.db().bookings.filter((b) => ['confirmed', 'in-progress'].includes(b.status) && b.assigned.some((a) => a.caregiverId === c.id)).length,
  })));

  constructor(title: Title) {
    title.setTitle('CareGo+ Admin | Caregivers');
  }

  protected decide(id: string, ok: boolean): void {
    this.store.act((db, now) => decideApplication(db, id, ok, now), ok ? 'Application approved. A caregiver account was created (temporary password: welcome123).' : 'Application declined.');
  }

  protected toggle(id: string, active: boolean): void {
    this.store.act((db) => setCaregiverActive(db, id, active), active ? 'Caregiver reactivated.' : 'Caregiver deactivated.');
  }
}
