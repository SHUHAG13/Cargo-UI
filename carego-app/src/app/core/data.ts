import { computed, inject, Injectable } from '@angular/core';
import { Store } from './store';
import { AuthService } from './auth';
import {
  Booking, Caregiver, Consultation, Patient, Payment, Session, SavedMethod,
} from './models';
import {
  bookingDue, bookingPaid, bookingPayable, bookingPendingCash, findBooking, findCaregiver, findPatient, patientStatus,
  sessionsCompleted, sessionsOf, sessionsOfCaregiver, paymentsReceived, balances, ledgerRows, atTime,
} from './domain/engine';

/** Read-side view of the store for the signed-in account. Components use this instead of filtering `db` themselves. */
@Injectable({ providedIn: 'root' })
export class Data {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);

  readonly db = this.store.db;
  readonly now = this.store.now;
  readonly today = this.store.today;

  // customer
  readonly myBookings = computed<Booking[]>(() => {
    const id = this.auth.account()?.id;
    return this.db().bookings.filter((b) => b.ownerId === id);
  });
  readonly myPatients = computed<Patient[]>(() => {
    const id = this.auth.account()?.id;
    return this.db().patients.filter((p) => p.ownerId === id);
  });
  readonly myPayments = computed<Payment[]>(() => {
    const ids = new Set(this.myBookings().map((b) => b.id));
    return this.db().payments.filter((p) => ids.has(p.bookingId)).sort((a, b) => b.at.localeCompare(a.at));
  });
  /** Doctor consultations booked by this account, newest appointment first. */
  readonly myConsultations = computed<Consultation[]>(() => {
    const id = this.auth.account()?.id;
    return this.db().consultations.filter((c) => c.ownerId === id).sort((a, b) => atTime(b.date, b.time).getTime() - atTime(a.date, a.time).getTime());
  });
  readonly myMethods = computed<SavedMethod[]>(() => {
    const id = this.auth.account()?.id;
    return this.db().savedMethods.filter((m) => m.ownerId === id);
  });

  // caregiver
  readonly myShifts = computed<Session[]>(() => {
    const id = this.auth.caregiverId();
    return id ? sessionsOfCaregiver(this.db(), id) : [];
  });
  readonly myAssignments = computed<Booking[]>(() => {
    const id = this.auth.caregiverId();
    return id ? this.db().bookings.filter((b) => b.assigned.some((a) => a.caregiverId === id)) : [];
  });
  readonly myBalances = computed(() => {
    const id = this.auth.caregiverId();
    return id ? balances(this.db(), id, this.now()) : { digitalHeld: 0, pendingClearance: 0, cashInHand: 0, netStanding: 0, withdrawn: 0 };
  });
  readonly myLedger = computed(() => {
    const id = this.auth.caregiverId();
    return id ? ledgerRows(this.db(), id, this.now()) : [];
  });

  // lookups
  booking = (id: string): Booking | undefined => findBooking(this.db(), id);
  patient = (id: string): Patient | undefined => findPatient(this.db(), id);
  caregiver = (id: string): Caregiver | undefined => findCaregiver(this.db(), id);
  sessions = (bookingId: string): Session[] => sessionsOf(this.db(), bookingId);
  done = (bookingId: string): number => sessionsCompleted(this.db(), bookingId);
  patientStatus = (id: string): 'Active' | 'Inactive' => patientStatus(this.db(), id);
  paid = bookingPaid;
  due = bookingDue;
  payable = bookingPayable;
  pendingCash = bookingPendingCash;
  received = paymentsReceived;

  /** Bookings of one patient, newest first. */
  bookingsOfPatient(patientId: string): Booking[] {
    return this.db().bookings.filter((b) => b.patientId === patientId);
  }

  caregiverName(id: string): string {
    return this.caregiver(id)?.name ?? '—';
  }
}
