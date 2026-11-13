import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Title } from '@angular/platform-browser';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { DomainError, submitMessage } from '../../../core/domain/engine';

@Component({
  selector: 'app-contact',
  imports: [FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
  host: { class: 'text-neutralDark' },
})
export class ContactPage {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);

  protected name = this.auth.account()?.name ?? '';
  protected company = '';
  protected phone = '';
  protected email = this.auth.account()?.identifier.includes('@') ? this.auth.account()!.identifier : '';
  protected subject = '';
  protected message = '';
  protected readonly sent = signal(false);
  protected readonly error = signal('');

  constructor(title: Title) {
    title.setTitle('CareGo+ | Contact Us');
  }

  protected send(): void {
    this.sent.set(false);
    try {
      const body = [this.subject.trim() && `[${this.subject.trim()}]`, this.message.trim(), this.company.trim() && `(Company: ${this.company.trim()})`].filter(Boolean).join(' ');
      this.store.actOrThrow((db, now) => submitMessage(db, { name: this.name, email: this.email, phone: this.phone, message: body }, now));
      this.error.set('');
      this.sent.set(true);
      this.company = this.phone = this.subject = this.message = '';
    } catch (e) {
      this.error.set(e instanceof DomainError ? e.message : 'We could not send your message. Please try again.');
    }
  }
}
