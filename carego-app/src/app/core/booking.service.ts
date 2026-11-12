import { computed, inject, Injectable, signal } from '@angular/core';
import { CatalogService, fmtDate, fmtLongDate } from './catalog.service';
import { Booking, BookingStatus, Installment, PriceBreakdown } from './models';
import type { BookingStore } from './booking-store';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

const catalogPrice = (c: CatalogService, base: number, hours: number, days: number, addOns: number): PriceBreakdown =>
  c.price({ pricePerDay: base } as never, hours, days, addOns);

/** Demo bookings taken from the prototype's "My Bookings" and booking-details pages. */
function seed(c: CatalogService): Booking[] {
  const start = new Date(2025, 4, 25);
  const main = catalogPrice(c, 1000, 24, 30, 500);
  const mainSchedule: Installment[] = c.schedule(main, 'weekly', start);
  const patient = { name: 'Rahima Begum', mobile: '+880 1712 345 678', age: 68, gender: 'Female', weightKg: 55, address: 'House 15, Road 8, Dhanmondi, Dhaka-1205' };
  const mk = (b: Partial<Booking> & Pick<Booking, 'id' | 'status' | 'statusNote' | 'bookedOn' | 'startDate' | 'startTime' | 'totalDays' | 'hoursPerDay' | 'amount' | 'paid' | 'packageName'>): Booking => ({
    category: 'caregiver', categoryName: 'Home Caregiver', installments: [], sessionsCompleted: 0, paymentsReceived: 0,
    paymentsTotal: 4, frequency: 'weekly', addOns: [], breakdown: main, patient, ...b,
  });
  return [
    mk({
      id: 'CG-250525-00123', patientId: 'PT-1001', status: 'pending', statusNote: 'Awaiting admin confirmation',
      bookedOn: '24 May 2025, 09:15 AM', startDate: '25 May 2025', startTime: '10:00 AM', endDate: '23 June 2025',
      totalDays: 30, hoursPerDay: 24, amount: main.total, paid: 0, packageName: 'Basic Care', installments: mainSchedule,
      paymentsTotal: 5, addOns: [{ name: 'Report Collection', provider: 'Caregiver', pricePerDay: 500 }],
    }),
    mk({
      id: 'CG-250515-00098', patientId: 'PT-1002', status: 'confirmed', statusNote: '30% payment received',
      bookedOn: '15 May 2025, 11:30 AM', startDate: '16 May 2025', startTime: '09:00 AM', totalDays: 15, hoursPerDay: 24,
      amount: 23655, paid: 7096.5, paidNote: '(30%)', packageName: 'Standard Care', paymentsReceived: 1, paymentsTotal: 3,
      breakdown: catalogPrice(c, 1500, 24, 15, 0), patient: { ...patient, name: 'Rokeya Begum' },
    }),
    mk({
      id: 'CG-250505-00076', patientId: 'PT-1001', status: 'in-progress', statusNote: 'Caregiver is providing service',
      bookedOn: '05 May 2025, 02:40 PM', startDate: '05 May 2025', startTime: '03:00 PM', totalDays: 20, hoursPerDay: 24,
      amount: 31400, paid: 9420, paidNote: '(30%)', packageName: 'Premium Care', sessionsCompleted: 12, paymentsReceived: 1,
      breakdown: catalogPrice(c, 1500, 24, 20, 0),
    }),
    mk({
      id: 'CG-250401-00056', patientId: 'PT-1003', status: 'completed', statusNote: 'Service completed',
      bookedOn: '01 Apr 2025, 04:20 PM', startDate: '03 Apr 2025', startTime: '08:00 AM', totalDays: 7, hoursPerDay: 12,
      amount: 10290, paid: 10290, packageName: 'Basic Care', sessionsCompleted: 7, paymentsReceived: 2, paymentsTotal: 2,
      breakdown: catalogPrice(c, 1000, 12, 7, 0), patient: { ...patient, name: 'Mofiz Uddin', gender: 'Male', age: 65 },
    }),
    mk({
      id: 'CG-250410-00065', status: 'cancelled', statusNote: 'Booking cancelled',
      bookedOn: '10 Apr 2025, 02:10 PM', startDate: '12 Apr 2025', startTime: '10:00 AM', totalDays: 10, hoursPerDay: 24,
      amount: 15750, paid: 0, packageName: 'Basic Care', paymentsTotal: 2, breakdown: catalogPrice(c, 1000, 24, 10, 0),
    }),
  ];
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly catalog = inject(CatalogService);
  private readonly _bookings = signal<Booking[]>(seed(this.catalog));

  readonly bookings = this._bookings.asReadonly();
  readonly counts = computed(() => {
    const c: Record<BookingStatus, number> = { pending: 0, confirmed: 0, 'in-progress': 0, completed: 0, cancelled: 0 };
    for (const b of this._bookings()) c[b.status]++;
    return c;
  });

  byId(id: string): Booking | undefined {
    return this._bookings().find((b) => b.id === id);
  }

  forPatient(patientId: string): Booking[] {
    return this._bookings().filter((b) => b.patientId === patientId);
  }

  cancel(id: string): void {
    this._bookings.update((list) => list.map((b) => b.id === id && (b.status === 'pending' || b.status === 'confirmed')
      ? { ...b, status: 'cancelled', statusNote: 'Booking cancelled' } : b));
  }

  /** Customer pays the next due instalment (demo: marks it paid and advances the status). */
  payNext(id: string): void {
    this._bookings.update((list) => list.map((b) => {
      if (b.id !== id) return b;
      const idx = b.installments.findIndex((i) => i.status !== 'paid');
      if (idx < 0) return b;
      const installments = b.installments.map((i, n) => n === idx ? { ...i, status: 'paid' as const } : i);
      const paid = Math.round((b.paid + b.installments[idx].amount) * 100) / 100;
      const status: BookingStatus = b.status === 'pending' || b.status === 'confirmed' ? 'confirmed' : b.status;
      return { ...b, installments, paid, status, paymentsReceived: b.paymentsReceived + 1,
        paidNote: idx === 0 ? '(30%)' : undefined, statusNote: idx === 0 ? '30% payment received' : b.statusNote };
    }));
  }

  /** Booking IDs follow the prototype: CG-YYMMDD-NNNNN. */
  private nextId(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seq = String(this._bookings().length + 124).padStart(5, '0');
    return `CG-${ymd}-${seq}`;
  }

  createFromWizard(w: BookingStore): Booking {
    const b = w.breakdown();
    const start = w.startDate()!;
    const now = new Date();
    const p = w.patient();
    const booking: Booking = {
      id: this.nextId(),
      category: w.categoryId(), categoryName: w.category().name, packageName: w.pkg()!.name,
      status: 'pending', statusNote: 'Awaiting admin confirmation',
      bookedOn: `${fmtDate(now)}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      startDate: fmtDate(start), startTime: w.startTime()!, endDate: fmtLongDate(w.endDate()!),
      totalDays: w.totalDays()!, hoursPerDay: w.hoursPerDay()!, amount: b.total, paid: 0,
      installments: w.schedule(), sessionsCompleted: 0, paymentsReceived: 0, paymentsTotal: w.schedule().length,
      frequency: w.frequency()!, addOns: w.selectedAddOns().map((a) => ({ name: a.name, provider: a.provider, pricePerDay: a.pricePerDay })),
      breakdown: b,
      patient: { name: p.fullName, mobile: p.attendantMobile, age: p.age ?? 0, gender: p.gender, weightKg: p.weightKg ?? 0, address: p.address },
    };
    this._bookings.update((list) => [booking, ...list]);
    return booking;
  }
}
