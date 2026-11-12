import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
  host: { class: 'bg-white text-gray-800 min-h-screen flex flex-col' },
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected identifier = '';
  protected fullName = '';
  protected password = '';
  protected confirm = '';
  protected agree = false;
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Create Account');
  }

  protected submit(): void {
    if (this.fullName.trim().length < 2) return this.error.set('Please enter your full name.');
    if (this.identifier.trim().length < 3) return this.error.set('Enter a valid phone number or email.');
    if (this.password.length < 8) return this.error.set('Password must be at least 8 characters.');
    if (this.password !== this.confirm) return this.error.set('Passwords do not match.');
    if (!this.agree) return this.error.set('Please accept the Terms and Privacy Policy.');
    this.auth.register(this.fullName.trim(), this.identifier.trim());
    this.router.navigateByUrl('/app/book');
  }

  /** Social sign-up is not connected in this build. */
  protected social(): void {
    this.error.set('Social sign-up is not available yet. Please use your email or phone.');
  }
}
