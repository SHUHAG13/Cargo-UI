import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BookingStore, CONSENT_SECTIONS } from '../../../core/booking-store';
import { CatalogService } from '../../../core/catalog.service';
import { BdtPipe } from '../../../core/money.pipe';
import { BookingSummary } from '../../../shared/booking-summary/booking-summary';
import { AddOnProvider, HoursPerDay, TotalDays } from '../../../core/models';

interface CalendarCell {
  date: Date;
  day: number;
  inMonth: boolean;
  past: boolean;
  selected: boolean;
  today: boolean;
}

const STEPS = ['Service', 'Schedule', 'Patient Info', 'Add-ons', 'Consent', 'Payment Structure', 'Confirmation', 'Review'];

/** 8-step "Book a New Service" wizard. State lives in BookingStore so it survives navigation. */
@Component({
  selector: 'app-booking-wizard',
  imports: [RouterLink, FormsModule, BdtPipe, DecimalPipe, BookingSummary],
  templateUrl: './booking-wizard.html',
  styleUrl: './booking-wizard.css',
  host: { class: 'bg-[#f9fafb] text-slate-900 min-h-screen' },
})
export class BookingWizardPage {
  protected readonly store = inject(BookingStore);
  protected readonly catalog = inject(CatalogService);
  protected readonly steps = STEPS;
  protected readonly consentSections = CONSENT_SECTIONS;
  protected readonly providers: { key: AddOnProvider; label: string }[] = [
    { key: 'Doctor', label: 'A. Done By Registered Doctor' },
    { key: 'Nurse', label: 'B. Done By BSC / Diploma Nurse (RN)' },
    { key: 'Caregiver', label: 'C. Done By Caregiver' },
  ];
  protected readonly openConsent = signal<number | null>(null);
  protected readonly copied = signal(false);

  // Calendar for the start-date picker
  private readonly today = startOfDay(new Date());
  protected readonly calMonth = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
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
      cells.push({
        date: d, day: d.getDate(), inMonth: d.getMonth() === first.getMonth(), past: d < this.today,
        selected: !!sel && sameDay(d, sel), today: sameDay(d, this.today),
      });
    }
    return cells;
  });

  protected readonly progressWidth = computed(() => `${((this.store.step() - 1) / (STEPS.length - 1)) * 100}%`);

  constructor(title: Title) {
    title.setTitle('CareGo+ | Book a New Service');
  }

  protected stepClass(n: number): string {
    const s = this.store.step();
    return n === s ? 'is-active' : n < s ? 'is-done' : '';
  }

  protected pickDays(d: TotalDays): void { this.store.totalDays.set(d); }
  protected pickHours(h: HoursPerDay): void { this.store.hoursPerDay.set(h); }

  protected pickDate(c: CalendarCell): void {
    if (c.past) return;
    this.store.startDate.set(startOfDay(c.date));
  }

  protected shiftMonth(delta: number): void {
    const m = this.calMonth();
    this.calMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected toggleConsent(i: number): void {
    this.openConsent.update((o) => (o === i ? null : i));
  }

  protected confirm(): void {
    if (!this.store.canGo(7)) return;
    this.store.placeBooking();
  }

  protected async copyId(): Promise<void> {
    const id = this.store.placedBooking()?.id;
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
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
