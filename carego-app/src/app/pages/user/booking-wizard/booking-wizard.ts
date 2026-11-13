import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BookingWizard } from '../../../core/wizard';
import { Data } from '../../../core/data';
import { AuthService } from '../../../core/auth';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { AddOnProvider, HoursPerDay, PackageTier, ServiceCategoryId, TotalDays } from '../../../core/models';
import { addOns, categories, START_TIMES, isoDay } from '../../../core/domain/catalog';
import { CONSENT_SECTIONS } from '../../../core/domain/consent';
import { BookingSummary } from '../../../shared/booking-summary/booking-summary';

interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
  past: boolean;
  selected: boolean;
  today: boolean;
}

const STEPS = ['Service', 'Schedule', 'Patient Info', 'Add-ons', 'Consent', 'Payment Structure', 'Confirmation', 'Review'];

/** 8-step "Book a New Service" wizard. State lives in BookingWizard so it survives navigation. */
@Component({
  selector: 'app-booking-wizard',
  imports: [RouterLink, FormsModule, BdtPipe, BookingSummary, ...FORMAT_PIPES],
  templateUrl: './booking-wizard.html',
  styleUrl: './booking-wizard.css',
  host: { class: 'bg-[#f9fafb] text-slate-900 min-h-screen' },
})
export class BookingWizardPage {
  protected readonly store = inject(BookingWizard);
  protected readonly data = inject(Data);
  protected readonly auth = inject(AuthService);

  protected readonly steps = STEPS;
  protected readonly categories = categories();
  protected readonly startTimes = START_TIMES;
  protected readonly dayOptions: TotalDays[] = [1, 7, 15, 30];
  protected readonly hourOptions: HoursPerDay[] = [8, 12, 24];
  protected readonly consentSections = CONSENT_SECTIONS;
  protected readonly providers: { key: AddOnProvider; label: string }[] = [
    { key: 'Doctor', label: 'A. Done By Registered Doctor' },
    { key: 'Nurse', label: 'B. Done By BSC / Diploma Nurse (RN)' },
    { key: 'Caregiver', label: 'C. Done By Caregiver' },
  ];
  protected addOnsBy = (p: AddOnProvider) => addOns().filter((a) => a.provider === p);
  protected readonly openConsent = signal<number | null>(null);
  protected readonly copied = signal(false);

  // Calendar for the start-date picker
  private readonly todayIso = isoDay(new Date());
  protected readonly calMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly calTitle = computed(() => this.calMonth().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  protected readonly calCells = computed<CalendarCell[]>(() => {
    const first = this.calMonth();
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const sel = this.store.startDate();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoDay(d);
      cells.push({ iso, day: d.getDate(), inMonth: d.getMonth() === first.getMonth(), past: iso < this.todayIso, selected: iso === sel, today: iso === this.todayIso });
    }
    return cells;
  });
  protected readonly canGoBackMonth = computed(() => {
    const m = this.calMonth();
    const now = new Date();
    return m.getFullYear() > now.getFullYear() || (m.getFullYear() === now.getFullYear() && m.getMonth() > now.getMonth());
  });

  /** The patient as shown on the review step, whether chosen from the saved list or typed in. */
  protected readonly reviewPatient = computed(() => {
    if (this.store.patientMode() === 'existing') {
      const p = this.store.selectedPatient();
      return {
        name: p?.name ?? '', age: p?.age ?? 0, gender: p?.gender ?? '', weight: p?.weightKg ?? null, mobility: p?.mobility ?? '', address: p?.address ?? '',
        attendant: p?.primaryContact.name ?? '', relation: p?.primaryContact.relation ?? '', mobile: p?.primaryContact.mobile ?? '',
      };
    }
    const n = this.store.newPatient();
    return {
      name: n.fullName, age: n.age ?? 0, gender: n.gender, weight: n.weightKg, mobility: n.mobility, address: n.address,
      attendant: n.attendantName, relation: n.attendantRelation, mobile: n.attendantMobile ? `+880 ${n.attendantMobile.replace(/^\+?880|^0/, '')}` : '',
    };
  });

  protected readonly progressWidth = computed(() => `${((this.store.step() - 1) / (STEPS.length - 1)) * 100}%`);
  protected readonly stepError = signal('');

  constructor(title: Title, route: ActivatedRoute) {
    title.setTitle('CareGo+ | Book a New Service');
    // A finished booking starts a fresh wizard next time.
    if (this.store.placed()) this.store.reset();
    // "Book Now" on the services page links here with ?category=&tier=.
    const q = route.snapshot.queryParamMap;
    const cat = q.get('category') as ServiceCategoryId | null;
    const tier = q.get('tier') as PackageTier | null;
    if (cat && this.categories.some((c) => c.id === cat)) {
      this.store.reset();
      this.store.selectCategory(cat);
      if (tier && ['basic', 'standard', 'premium'].includes(tier)) {
        this.store.selectTier(tier);
        this.store.goTo(2);
      }
    }
    // One patient and nothing chosen yet: pre-select them.
    const mine = this.data.myPatients();
    if (!this.store.patientId() && mine.length) this.store.patientId.set(mine[0].id);
    if (!mine.length) this.store.patientMode.set('new');
  }

  protected stepClass(n: number): string {
    const s = this.store.step();
    return n === s ? 'is-active' : n < s ? 'is-done' : '';
  }

  protected daysAllowed(d: TotalDays): boolean {
    return !this.store.pkg() || this.store.pkg()!.allowedDays.includes(d);
  }

  protected hoursAllowed(h: HoursPerDay): boolean {
    return !this.store.pkg() || this.store.pkg()!.allowedHours.includes(h);
  }

  protected pickDate(c: CalendarCell): void {
    if (c.past) return;
    this.store.startDate.set(c.iso);
  }

  protected shiftMonth(delta: number): void {
    if (delta < 0 && !this.canGoBackMonth()) return;
    const m = this.calMonth();
    this.calMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected toggleConsent(i: number): void {
    this.openConsent.update((o) => (o === i ? null : i));
  }

  protected confirm(): void {
    this.stepError.set('');
    if (!this.store.kycOk()) {
      this.stepError.set('Complete identity verification (NID + selfie) before booking.');
      return;
    }
    this.store.confirm();
  }

  protected async copyId(): Promise<void> {
    const id = this.store.placed()?.id;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  protected startNew(): void {
    this.store.reset();
  }

  protected setFrequency(f: 'together' | 'weekly' | 'daily', allowed: boolean): void {
    if (allowed) this.store.frequency.set(f);
  }

  /** Patient fields on the "new patient" form write straight through to the wizard state. */
  protected patch(field: string, value: unknown): void {
    this.store.updateNewPatient({ [field]: value } as never);
  }
}
