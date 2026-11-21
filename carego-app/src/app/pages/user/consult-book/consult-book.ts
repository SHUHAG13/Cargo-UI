import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { ConsultKind, ConsultMode, ConsultPatient, PayMethod } from '../../../core/models';
import { CONCERNS } from '../../../core/domain/doctors';
import { bookConsultation, consultFee, doctorById, doctorForOffer, fullName, offerById, specialtyById } from '../../../core/domain/consult';
import { DomainError, isValidBdMobile } from '../../../core/domain/engine';
import { fmtDay, luhn } from '../../../core/domain/catalog';
import { Avatar } from '../../../shared/avatar/avatar';

type Method = Exclude<PayMethod, 'Cash to Staff'>;

/** Checkout for a doctor consultation: who it is for, what is wrong, and payment. */
@Component({
  selector: 'app-consult-book',
  imports: [FormsModule, RouterLink, Avatar],
  templateUrl: './consult-book.html',
})
export class ConsultBookPage {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly data = inject(Data);

  private readonly q = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly offer = offerById(this.q.get('offer') ?? '');
  protected readonly followUpOf = this.q.get('followUp') ?? undefined;
  protected readonly kind: ConsultKind = this.followUpOf ? 'follow-up' : this.offer || this.q.get('instant') ? 'instant' : 'scheduled';
  protected readonly doctor = this.offer ? doctorForOffer(this.offer) : doctorById(this.q.get('doctor') ?? '');
  protected readonly mode: ConsultMode = this.kind === 'instant' ? 'video' : ((this.q.get('mode') as ConsultMode) ?? 'video');
  protected readonly date = this.q.get('date') ?? '';
  protected readonly time = this.q.get('time') ?? '';
  protected readonly specialty = this.doctor ? specialtyById(this.doctor.specialtyId) : undefined;
  protected readonly name = this.doctor ? fullName(this.doctor) : '';
  protected readonly dayLabel = this.date ? fmtDay(this.date) : '';
  /** Missing doctor, or a scheduled visit without a slot: the link is broken. */
  protected readonly invalid = !this.doctor || (this.kind !== 'instant' && !(this.date && this.time));

  protected readonly fee = computed(() => {
    if (this.invalid) return 0;
    try {
      return consultFee(this.data.db(), this.auth.account()!.id, { doctorId: this.doctor!.id, kind: this.kind, followUpOf: this.followUpOf, offerId: this.offer?.id }, this.data.now());
    } catch (e) {
      if (e instanceof DomainError) return null;
      throw e;
    }
  });
  protected readonly listFee = computed(() => {
    const d = this.doctor;
    if (!d || this.kind === 'follow-up') return 0;
    return this.kind === 'instant' && this.offer ? d.fee : d.listFee ?? 0;
  });

  protected readonly concerns = CONCERNS.filter((c) => c.specialtyId === this.doctor?.specialtyId || c.specialtyId === 'general').map((c) => c.label);

  // who
  protected readonly who = signal<string>('self');
  protected selfAge: number | null = null;
  protected selfGender: ConsultPatient['gender'] = 'Male';
  protected symptoms = '';
  protected agree = false;

  // payment
  protected readonly method = signal<Method>('bKash');
  protected readonly savedId = signal<string | null>(null);
  protected mobile = '';
  protected cardNumber = '';
  protected expiry = '';
  protected cvc = '';
  protected readonly methods: { id: Method; icon: string; hint: string }[] = [
    { id: 'bKash', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Nagad', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Rocket', icon: 'fa-solid fa-mobile-screen', hint: 'Mobile wallet' },
    { id: 'Card', icon: 'fa-regular fa-credit-card', hint: 'Visa / Mastercard' },
  ];

  protected readonly error = signal('');
  protected readonly busy = signal(false);

  constructor(title: Title) {
    title.setTitle('CareGo+ | Book a Consultation');
    // A follow-up is for the same patient as the original visit.
    const orig = this.followUpOf ? this.data.myConsultations().find((c) => c.id === this.followUpOf) : undefined;
    if (orig) {
      this.who.set(orig.patient.id ?? 'self');
      if (!orig.patient.id) { this.selfAge = orig.patient.age; this.selfGender = orig.patient.gender; }
      this.symptoms = `Follow-up: ${orig.prescription?.diagnosis ?? orig.symptoms}. `;
    }
  }

  protected addConcern(label: string): void {
    this.symptoms = this.symptoms.trim() ? `${this.symptoms.trim().replace(/[.,]?$/, ',')} ${label.toLowerCase()}` : label;
  }

  protected pickSaved(id: string, type: string): void {
    this.savedId.set(id);
    this.method.set(type.includes('Card') ? 'Card' : (type as Method));
    this.error.set('');
  }

  protected pickMethod(m: Method): void {
    this.method.set(m);
    this.savedId.set(null);
    this.error.set('');
  }

  private patient(): ConsultPatient | null {
    if (this.who() === 'self') {
      const acc = this.auth.account()!;
      return this.selfAge === null ? null : { id: null, name: acc.name, age: Number(this.selfAge), gender: this.selfGender };
    }
    const p = this.data.myPatients().find((x) => x.id === this.who());
    return p ? { id: p.id, name: p.name, age: p.age, gender: p.gender } : null;
  }

  /** Validates the simulated payment details; returns the masked reference or sets an error. */
  private paymentRef(): string | null {
    const saved = this.savedId() ? this.data.myMethods().find((s) => s.id === this.savedId()) : null;
    if (saved) return saved.masked;
    const m = this.method();
    if (m !== 'Card') {
      if (!isValidBdMobile(this.mobile)) { this.error.set(`Enter the ${m} mobile number you will pay from (e.g. 01712345678).`); return null; }
      const n = this.mobile.replace(/\D/g, '').slice(-11);
      return `${n.slice(0, 4)}***${n.slice(-3)}`;
    }
    if (!luhn(this.cardNumber)) { this.error.set('That card number is not valid.'); return null; }
    const ex = /^(\d{2})\s*\/\s*(\d{2})$/.exec(this.expiry.trim());
    const now = new Date();
    if (!ex || Number(ex[1]) < 1 || Number(ex[1]) > 12 || Number(`20${ex[2]}`) * 12 + Number(ex[1]) < now.getFullYear() * 12 + now.getMonth() + 1) {
      this.error.set('Enter a valid expiry date (MM/YY) that has not passed.');
      return null;
    }
    if (!/^\d{3,4}$/.test(this.cvc)) { this.error.set('Enter the 3 or 4 digit security code.'); return null; }
    const digits = this.cardNumber.replace(/\s/g, '');
    if (digits === '4000000000000002') { this.error.set('The card was declined. Try another card or method.'); return null; }
    return `**** ${digits.slice(-4)}`;
  }

  protected submit(): void {
    this.error.set('');
    const fee = this.fee();
    if (this.invalid || fee === null) return;
    const patient = this.patient();
    if (!patient) return this.error.set('Enter your age so the doctor has the basics.');
    if (this.symptoms.trim().length < 5) return this.error.set('Describe the problem in a few words so the doctor can prepare.');
    if (!this.agree) return this.error.set('Please confirm you have read the note about emergencies.');
    let payment: { method: PayMethod; reference: string } | null = null;
    if (fee > 0) {
      const ref = this.paymentRef();
      if (!ref) return;
      payment = { method: this.method(), reference: ref };
    }
    this.busy.set(true);
    try {
      const c = this.store.actOrThrow((db, now) => bookConsultation(db, this.auth.account()!.id, {
        doctorId: this.doctor!.id, mode: this.mode, kind: this.kind, date: this.date, time: this.time, patient,
        symptoms: this.symptoms, payment, followUpOf: this.followUpOf, offerId: this.offer?.id,
      }, now));
      this.router.navigate(['/app/consultations', c.id], { queryParams: this.kind === 'instant' ? { join: 1 } : { booked: 1 } });
    } catch (e) {
      if (e instanceof DomainError) this.error.set(e.message);
      else throw e;
    } finally {
      this.busy.set(false);
    }
  }
}
