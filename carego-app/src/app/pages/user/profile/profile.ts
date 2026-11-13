import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth';
import { Store } from '../../../core/store';
import { ToastService } from '../../../core/toast';
import { DomainError } from '../../../core/domain/engine';
import { Avatar } from '../../../shared/avatar/avatar';
import { FORMAT_PIPES } from '../../../core/format.pipes';

/** Account page: sign-in details and the NID + selfie identity check that unlocks booking. */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, FormsModule, Avatar, ...FORMAT_PIPES],
  templateUrl: './profile.html',
  host: { class: 'block' },
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly toasts = inject(ToastService);
  protected readonly highlight = inject(ActivatedRoute).snapshot.queryParamMap.has('verify');

  protected nid = '';
  protected selfie: File | null = null;
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Profile');
  }

  protected pick(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set('');
    if (f && !/^image\//.test(f.type)) {
      this.error.set('Please choose an image file for your selfie.');
      this.selfie = null;
      this.preview.set(null);
      return;
    }
    if (f && f.size > 5 * 1024 * 1024) {
      this.error.set('The selfie must be 5 MB or smaller.');
      return;
    }
    this.selfie = f;
    this.preview.set(f ? URL.createObjectURL(f) : null);
  }

  protected verify(): void {
    try {
      this.auth.completeKyc(this.nid, this.selfie?.name ?? '');
      this.toasts.success('Identity verified. You can now book services.');
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof DomainError ? e.message : 'Verification failed. Please try again.');
    }
  }

  protected reset(): void {
    if (confirm('Reset all demo data (bookings, payments, patients) to the starting dataset?')) {
      this.store.reset();
      this.auth.logout();
    }
  }
}
