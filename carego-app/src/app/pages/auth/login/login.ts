import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth.service';

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

  protected identifier = '';
  protected password = '';
  protected remember = true;
  protected readonly showPassword = signal(false);
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Login');
  }

  protected submit(): void {
    if (this.identifier.trim().length < 3 || this.password.length < 4) {
      this.error.set('Enter your email or phone and password to continue.');
      return;
    }
    this.auth.login(this.identifier.trim(), this.password, this.remember);
    this.router.navigateByUrl('/app/bookings');
  }

  /** Social sign-in is not connected in this build. */
  protected social(): void {
    this.error.set('Social sign-in is not available yet. Please use your email or phone.');
  }
}
