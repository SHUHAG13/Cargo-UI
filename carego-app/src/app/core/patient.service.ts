import { Injectable, signal } from '@angular/core';
import { Patient } from './models';

const SEED: Patient[] = [
  {
    id: 'PT-1001', name: 'Abdul Karim', gender: 'Male', age: 72, status: 'Active', addedOn: '20 May 2025',
    mobile: '+880 1712 345 678', bookingLabel: 'Active Booking', bookingService: 'Home Caregiver', bookingPackage: 'Standard Care',
    bookingId: 'CG-250525-00123', nextServiceLabel: 'Next Service', nextService: '25 May 2025, 10:00 AM',
  },
  {
    id: 'PT-1002', name: 'Rokeya Begum', gender: 'Female', age: 68, status: 'Active', addedOn: '18 May 2025',
    mobile: '+880 1912 345 679', bookingLabel: 'Upcoming Booking', bookingService: 'Physiotherapy',
    bookingId: 'CG-250518-00098', nextServiceLabel: 'Next Service', nextService: '26 May 2025, 11:00 AM',
  },
  {
    id: 'PT-1003', name: 'Mofiz Uddin', gender: 'Male', age: 65, status: 'Inactive', addedOn: '10 May 2025',
    mobile: '+880 1812 345 680', bookingLabel: 'Last Booking', bookingService: 'Home Caregiver', bookingPackage: 'Basic Care',
    bookingId: 'CG-250510-00056', nextServiceLabel: 'Completed on', nextService: '15 May 2025',
  },
];

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly _patients = signal<Patient[]>(SEED);
  readonly patients = this._patients.asReadonly();

  byId(id: string): Patient | undefined {
    return this._patients().find((p) => p.id === id);
  }

  add(p: Omit<Patient, 'id' | 'addedOn'>): Patient {
    const id = `PT-${1000 + this._patients().length + 1}`;
    const added = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const patient: Patient = { ...p, id, addedOn: added };
    this._patients.update((l) => [patient, ...l]);
    return patient;
  }
}
