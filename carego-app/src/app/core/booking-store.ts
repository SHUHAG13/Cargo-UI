import { computed, inject, Injectable, signal } from '@angular/core';
import { CatalogService, addDays, fmtDate } from './catalog.service';
import { BookingService } from './booking.service';
import {
  Booking, HoursPerDay, PackageTier, PatientInfo, PaymentFrequency, ServiceCategoryId, TotalDays,
} from './models';

export const EMPTY_PATIENT: PatientInfo = {
  fullName: '', age: null, gender: '', weightKg: null, address: '', medicalCondition: '', mobility: 'Mobile',
  attendantName: '', attendantRelation: '', attendantMobile: '', secondaryName: '', secondaryRelation: '', secondaryMobile: '',
};

export const CONSENT_SECTIONS = [
  { title: '1. CONSENT FOR SERVICES', text: 'I understand and voluntarily consent to the care and support services to be provided as per the selected plan. I acknowledge the nature and purpose of the services.' },
  { title: '2. MEDICAL RESPONSIBILITY DECLARATION', text: 'I confirm that I have provided accurate medical information. I understand that CareGo+ staff are not doctors and do not replace medical professionals.' },
  { title: '3. EMERGENCY & HOSPITAL TRANSFER CONSENT', text: 'I authorize CareGo+ staff to arrange emergency medical assistance and transfer to the nearest appropriate hospital if necessary.' },
  { title: '4. STAFF SAFETY & WORKING ENVIRONMENT', text: 'I agree to provide a safe, respectful and hygienic environment for the staff. I understand that abusive or unsafe behavior may result in service termination.' },
  { title: '5. PAYMENT & REPLACEMENT POLICY', text: 'I understand the payment terms, refund policy and replacement conditions as outlined by CareGo+.' },
  { title: '6. LIABILITY LIMITATION', text: 'I acknowledge that CareGo+ is not liable for any indirect, incidental or consequential damage arising from the use of this service.' },
  { title: '7. DECLARATION', text: 'I have read, understood and agree to all the above terms and conditions, and affirm that the information provided is true and correct to the best of my knowledge.' },
];

/** State of the 8-step "Book a New Service" wizard. Survives in-app navigation; reset() after a booking is placed. */
@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly catalog = inject(CatalogService);
  private readonly bookings = inject(BookingService);

  readonly step = signal(1);
  readonly maxStepReached = signal(1);

  readonly categoryId = signal<ServiceCategoryId>('caregiver');
  readonly tier = signal<PackageTier | null>(null);
  readonly totalDays = signal<TotalDays | null>(null);
  readonly hoursPerDay = signal<HoursPerDay | null>(null);
  readonly startDate = signal<Date | null>(null);
  readonly startTime = signal<string | null>(null);
  readonly patient = signal<PatientInfo>({ ...EMPTY_PATIENT });
  readonly addOnIds = signal<Set<string>>(new Set());
  readonly consentGiven = signal(false);
  readonly frequency = signal<PaymentFrequency | null>(null);
  readonly placedBooking = signal<Booking | null>(null);

  readonly category = computed(() => this.catalog.category(this.categoryId()));
  readonly pkg = computed(() => this.category().packages.find((p) => p.tier === this.tier()) ?? null);
  readonly selectedAddOns = computed(() => this.catalog.addOns.filter((a) => this.addOnIds().has(a.id)));
  readonly addOnsPerDay = computed(() => this.selectedAddOns().reduce((s, a) => s + a.pricePerDay, 0));
  readonly breakdown = computed(() =>
    this.catalog.price(this.pkg(), this.hoursPerDay() ?? 0, this.totalDays() ?? 0, this.addOnsPerDay()));
  readonly schedule = computed(() => this.frequency()
    ? this.catalog.schedule(this.breakdown(), this.frequency()!, this.startDate()) : []);
  readonly installmentOptions = computed(() => {
    const b = this.breakdown();
    const days = this.totalDays() ?? 0;
    return (['together', 'weekly', 'daily'] as PaymentFrequency[]).map((f) => {
      const n = this.catalog.installmentCount(f, days);
      return { frequency: f, count: n, amount: Math.round((b.remaining / n) * 100) / 100 };
    });
  });
  readonly endDate = computed(() => {
    const s = this.startDate();
    const d = this.totalDays();
    return s && d ? addDays(s, d - 1) : null;
  });

  readonly step1Valid = computed(() => !!this.pkg());
  readonly step2Valid = computed(() => !!this.totalDays() && !!this.hoursPerDay() && !!this.startDate() && !!this.startTime());
  readonly step3Valid = computed(() => {
    const p = this.patient();
    return p.fullName.trim().length > 1 && !!p.age && !!p.gender && p.address.trim().length > 3
      && p.attendantName.trim().length > 1 && p.attendantRelation.trim().length > 0 && /^\d{8,11}$/.test(p.attendantMobile.replace(/[\s-]/g, ''));
  });
  readonly step5Valid = computed(() => this.consentGiven());
  readonly step6Valid = computed(() => !!this.frequency());

  canGo(step: number): boolean {
    if (step <= 1) return true;
    if (step === 8) return !!this.placedBooking();
    const gates = [true, this.step1Valid(), this.step2Valid(), this.step3Valid(), true, this.step5Valid(), this.step6Valid()];
    return gates.slice(1, step).every(Boolean);
  }

  goTo(step: number): void {
    if (!this.canGo(step)) return;
    this.step.set(step);
    this.maxStepReached.update((m) => Math.max(m, step));
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  next(): void { this.goTo(this.step() + 1); }
  back(): void { this.goTo(this.step() - 1); }

  selectCategory(id: ServiceCategoryId): void {
    this.categoryId.set(id);
    if (this.tier() && !this.pkg()) this.tier.set(null);
  }

  toggleAddOn(id: string): void {
    this.addOnIds.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  updatePatient(patch: Partial<PatientInfo>): void {
    this.patient.update((p) => ({ ...p, ...patch }));
  }

  startDateLabel(): string {
    const d = this.startDate();
    return d ? fmtDate(d) : '—';
  }

  /** Step 7 "Book Service": persist the booking as Pending (awaiting admin confirmation) and move to step 8. */
  placeBooking(): Booking {
    const booking = this.bookings.createFromWizard(this);
    this.placedBooking.set(booking);
    this.step.set(8);
    this.maxStepReached.set(8);
    window.scrollTo({ top: 0 });
    return booking;
  }

  reset(): void {
    this.step.set(1); this.maxStepReached.set(1);
    this.tier.set(null); this.totalDays.set(null); this.hoursPerDay.set(null);
    this.startDate.set(null); this.startTime.set(null); this.patient.set({ ...EMPTY_PATIENT });
    this.addOnIds.set(new Set()); this.consentGiven.set(false); this.frequency.set(null); this.placedBooking.set(null);
  }
}
