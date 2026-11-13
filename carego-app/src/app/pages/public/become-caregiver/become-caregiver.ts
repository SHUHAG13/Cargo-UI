import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Store } from '../../../core/store';
import { DomainError, submitApplication } from '../../../core/domain/engine';
import { StaffKind } from '../../../core/models';

/** Public application form for people who want to work as caregivers; admins review it in the console. */
@Component({
  selector: 'app-become-caregiver',
  imports: [FormsModule, RouterLink],
  templateUrl: './become-caregiver.html',
  host: { class: 'block bg-slate-50' },
})
export class BecomeCaregiverPage {
  private readonly store = inject(Store);

  protected name = '';
  protected phone = '';
  protected email = '';
  protected kind: StaffKind = 'Caregiver';
  protected experienceYears: number | null = null;
  protected nid = '';
  protected notes = '';
  protected readonly done = signal(false);
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Become a Caregiver');
  }

  protected submit(): void {
    try {
      this.store.actOrThrow((db, now) => submitApplication(db, {
        name: this.name, phone: this.phone, email: this.email, kind: this.kind, experienceYears: this.experienceYears ?? -1, nid: this.nid, notes: this.notes,
      }, now));
      this.error.set('');
      this.done.set(true);
    } catch (e) {
      this.error.set(e instanceof DomainError ? e.message : 'We could not submit your application. Please try again.');
    }
  }
}
