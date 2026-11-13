import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth';
import { Store } from './store';
import {
  AddOn, Booking, HoursPerDay, PackageTier, PaymentFrequency, ServiceCategoryId, TotalDays,
} from './models';
import {
  addOnBlockedReason, addOns, buildInstallments, category, frequencyAllowed, installmentCount, isoDay, price, round2,
} from './domain/catalog';
import { PatientInput, placeBooking, validatePatientInput } from './domain/engine';

export const blankPatientInput = (): PatientInput => ({
  fullName: '', age: null, gender: '', weightKg: null, address: '', medicalCondition: '', mobility: 'Mobile',
  attendantName: '', attendantRelation: '', attendantMobile: '', secondaryName: '', secondaryRelation: '', secondaryMobile: '',
});

/** State of the 8-step "Book a New Service" wizard. It survives in-app navigation; reset() after a booking is placed. */
@Injectable({ providedIn: 'root' })
export class BookingWizard {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);

  readonly step = signal(1);

  readonly categoryId = signal<ServiceCategoryId>('caregiver');
  readonly tier = signal<PackageTier | null>(null);
  readonly totalDays = signal<TotalDays | null>(null);
  readonly hoursPerDay = signal<HoursPerDay | null>(null);
  readonly startDate = signal<string | null>(null);
  readonly startTime = signal<string | null>(null);
  readonly patientMode = signal<'existing' | 'new'>('existing');
  readonly patientId = signal<string | null>(null);
  readonly newPatient = signal<PatientInput>(blankPatientInput());
  readonly addOnIds = signal<Set<string>>(new Set());
  readonly consentGiven = signal(false);
  readonly frequency = signal<PaymentFrequency | null>(null);
  readonly placed = signal<Booking | null>(null);

  readonly category = computed(() => category(this.categoryId()));
  readonly pkg = computed(() => this.category().packages.find((p) => p.tier === this.tier()) ?? null);
  readonly selectedAddOns = computed<AddOn[]>(() => addOns().filter((a) => this.addOnIds().has(a.id)));
  readonly addOnsPerDay = computed(() => this.selectedAddOns().reduce((s, a) => s + a.pricePerDay, 0));
  readonly breakdown = computed(() => price(this.pkg()?.pricePerDay ?? 0, this.hoursPerDay() ?? 0, this.totalDays() ?? 0, this.addOnsPerDay()));
  readonly endDate = computed(() => {
    const s = this.startDate();
    const d = this.totalDays();
    if (!s || !d) return null;
    const [y, m, day] = s.split('-').map(Number);
    return isoDay(new Date(y, m - 1, day + d - 1));
  });

  readonly frequencyOptions = computed(() => {
    const b = this.breakdown();
    const days = this.totalDays() ?? 0;
    return (['together', 'weekly', 'daily'] as PaymentFrequency[]).map((f) => {
      const n = installmentCount(f, days);
      return { frequency: f, count: n, amount: round2(b.remaining / n), allowed: !!days && frequencyAllowed(f, days) };
    });
  });
  readonly schedule = computed(() => {
    const f = this.frequency();
    const s = this.startDate();
    return f && s && this.totalDays() ? buildInstallments(this.breakdown(), f, s) : [];
  });

  readonly selectedPatient = computed(() => {
    const id = this.patientId();
    return id ? this.store.db().patients.find((p) => p.id === id) ?? null : null;
  });

  readonly step1Valid = computed(() => !!this.pkg());
  readonly step2Valid = computed(() => {
    const p = this.pkg();
    const d = this.totalDays();
    const h = this.hoursPerDay();
    return !!p && !!d && !!h && p.allowedDays.includes(d) && p.allowedHours.includes(h) && !!this.startDate() && !!this.startTime();
  });
  readonly patientError = computed(() => {
    if (this.patientMode() === 'existing') return this.patientId() ? null : 'Choose a patient or add a new one.';
    return validatePatientInput(this.newPatient());
  });
  readonly step3Valid = computed(() => !this.patientError());
  readonly step5Valid = computed(() => this.consentGiven());
  readonly step6Valid = computed(() => {
    const f = this.frequency();
    return !!f && frequencyAllowed(f, this.totalDays() ?? 0);
  });
  readonly kycOk = computed(() => this.auth.kycVerified());

  canGo(step: number): boolean {
    if (step <= 1) return true;
    if (step === 8) return !!this.placed();
    if (this.placed()) return false;
    const gates = [this.step1Valid(), this.step2Valid(), this.step3Valid(), true, this.step5Valid(), this.step6Valid(), true];
    return gates.slice(0, step - 1).every(Boolean);
  }

  goTo(step: number): void {
    if (!this.canGo(step)) return;
    this.step.set(step);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  next(): void { this.goTo(this.step() + 1); }
  back(): void { this.goTo(this.step() - 1); }

  selectCategory(id: ServiceCategoryId): void {
    this.categoryId.set(id);
    this.revalidate();
  }

  selectTier(t: PackageTier): void {
    this.tier.set(t);
    this.revalidate();
  }

  /** Drop any earlier choice the newly picked package does not allow. */
  private revalidate(): void {
    const p = this.pkg();
    if (!p) return;
    if (this.totalDays() && !p.allowedDays.includes(this.totalDays()!)) this.totalDays.set(null);
    if (this.hoursPerDay() && !p.allowedHours.includes(this.hoursPerDay()!)) this.hoursPerDay.set(null);
    // A package with a single choice is pre-selected.
    if (!this.hoursPerDay() && p.allowedHours.length === 1) this.hoursPerDay.set(p.allowedHours[0]);
    this.pruneAddOns();
    this.pruneFrequency();
  }

  pickDays(d: TotalDays): void {
    this.totalDays.set(d);
    this.pruneAddOns();
    this.pruneFrequency();
  }

  pickHours(h: HoursPerDay): void {
    this.hoursPerDay.set(h);
  }

  private pruneAddOns(): void {
    const days = this.totalDays();
    this.addOnIds.update((s) => new Set([...s].filter((id) => {
      const a = addOns().find((x) => x.id === id);
      return !!a && !addOnBlockedReason(a, days);
    })));
  }

  private pruneFrequency(): void {
    const f = this.frequency();
    if (f && !frequencyAllowed(f, this.totalDays() ?? 0)) this.frequency.set(null);
  }

  blockedReason(a: AddOn): string | null {
    return addOnBlockedReason(a, this.totalDays());
  }

  toggleAddOn(id: string): void {
    const a = addOns().find((x) => x.id === id);
    if (!a || this.blockedReason(a)) return;
    this.addOnIds.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  updateNewPatient(patch: Partial<PatientInput>): void {
    this.newPatient.update((p) => ({ ...p, ...patch }));
  }

  /** Step 7 "Book Service": creates the booking as Pending (awaiting admin confirmation) and moves to step 8. */
  confirm(): Booking | undefined {
    const owner = this.auth.account()?.id;
    if (!owner) return undefined;
    const p = this.pkg()!;
    const b = this.store.act((db, now) => placeBooking(db, owner, {
      category: this.categoryId(), tier: p.tier, hoursPerDay: this.hoursPerDay()!, totalDays: this.totalDays()!,
      startDate: this.startDate()!, startTime: this.startTime()!, addOnIds: [...this.addOnIds()], frequency: this.frequency()!,
      patientId: this.patientMode() === 'existing' ? this.patientId()! : undefined,
      newPatient: this.patientMode() === 'new' ? this.newPatient() : undefined, consent: this.consentGiven(),
    }, now));
    if (b) {
      this.placed.set(b);
      this.step.set(8);
      window.scrollTo({ top: 0 });
    }
    return b;
  }

  reset(): void {
    this.step.set(1);
    this.tier.set(null);
    this.totalDays.set(null);
    this.hoursPerDay.set(null);
    this.startDate.set(null);
    this.startTime.set(null);
    this.patientMode.set('existing');
    this.patientId.set(null);
    this.newPatient.set(blankPatientInput());
    this.addOnIds.set(new Set());
    this.consentGiven.set(false);
    this.frequency.set(null);
    this.placed.set(null);
  }
}
