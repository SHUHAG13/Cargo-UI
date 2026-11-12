import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { PatientService } from '../../../core/patient.service';

type PatientTab = 'overview' | 'bookings' | 'documents' | 'notes';

/** Patient details at /app/patients/:id with Details / Bookings / Documents / Notes tabs. */
@Component({
  selector: 'app-patient-details',
  imports: [RouterLink],
  templateUrl: './patient-details.html',
  styleUrl: './patient-details.css',
  host: { class: 'flex min-h-screen text-slate-700' },
})
export class PatientDetailsPage {
  private readonly patients = inject(PatientService);
  private readonly title = inject(Title);
  readonly id = input.required<string>();

  protected readonly tab = signal<PatientTab>('overview');
  protected readonly patient = computed(() => this.patients.byId(this.id()));

  constructor() {
    this.title.setTitle('CareGo+ | Patient Details');
  }
}
