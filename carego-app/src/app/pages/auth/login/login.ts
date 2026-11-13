import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth';
import { DEMO_ACCOUNTS } from '../../../shared/ui';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  host: { class: 'bg-white text-gray-800 min-h-screen flex flex-col' },
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected identifier = '';
  protected password = '';
  protected remember = true;
  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly showPassword = signal(false);
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Login');
    // Already signed in: go straight to the right portal.
    if (this.auth.isLoggedIn()) this.router.navigateByUrl(this.auth.home(this.auth.role()!));
  }

  protected fill(a: { identifier: string; password: string }): void {
    this.identifier = a.identifier;
    this.password = a.password;
    this.error.set('');
  }

  protected submit(): void {
    if (!this.identifier.trim() || !this.password) {
      this.error.set('Enter your email or phone and your password.');
      return;
    }
    const acc = this.auth.login(this.identifier, this.password, this.remember);
    if (!acc) {
      this.error.set('We could not find an account with those details. Check them and try again.');
      return;
    }
    const role = this.auth.role()!;
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    // Only honour a return URL that belongs to the portal the account is actually in.
    const allowed = back && back.startsWith(role === 'admin' ? '/admin' : role === 'caregiver' ? '/caregiver' : '/app');
    this.router.navigateByUrl(allowed ? back! : this.auth.home(role));
  }

  /** Social sign-in is not connected in this build. */
  protected social(): void {
    this.error.set('Social sign-in is not available yet. Please use your email or phone.');
  }
}
