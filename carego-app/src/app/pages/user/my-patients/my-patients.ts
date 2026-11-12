import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { PatientService } from '../../../core/patient.service';
import { BookingService } from '../../../core/booking.service';

const PATIENT_PHOTOS: Record<string, string> = {
  'PT-1001': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLdsZnEvaRLCDmzGKZ-RL2Ooj1_wH4luJ5l6bfAN1F8eXCA3PdzkotDiNO8wjtWR-kU9f0Ym5lQj8DtE3UqsjoBqh__zM8LWBEEO5LI1qKmul9xLCHMsHSc5KtW72P3oXM4C6sDhB8ytQysgVVi27CHtEp-34KCvD-NU8FUrsYY0cMeJFm_oIKMTu9DQ-T_oosWFOm5kfTBVwS-kYrnt4jndv0-0ZwELC1dGewLUsSLp_269Bz3S2C65LEj3GTaJPp8mPaLOF59EI',
  'PT-1002': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVTEdj1VyASSE0Vw0ULcmCVCNfMN-fz0PF85D9iX-Bx2G-0OmTMMBYAoAmE0mn0aTiOo9fg7mPLOgg8CLuiDnxPLG2Sq55aPXl31qYKohg9cByQ_pcyZV-uBweKt7-5zQkDgd1fRkAd79ARvsMQxa2CGGofYAyiYraOG5KkDAwDMaqslXrk8teVhzFiY-YVIPW6mh5EzvQntlSVwa8f7WFoz-INclmqPDUrRgQyLcs1N2ugob86ww5Uf0i0j_gF_Njv1DbgkBIEeo',
  'PT-1003': 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_z6hejmc16ORRFhJpgciZIvBVHkWBzsiIY77WqUeuMykpfdlu4-LmSgRmT8yKmAW5l_m9-hjVri0zAnaxltxB4nozbWtpPWEhWcwi0-XddZcWSL-lkWl-xamot_Ry6H5LXXiNiZAfevML8jwlvrPDwqKe8_Ah8JjRB0_qP5YiV4ZWXWpjwD_F_iDbtHMzKQBXE6bOEVOSQkEBt0jL_jG9vicsTvGTHU4CTHsQiEBS14FbVWTOkTrjwM2tGnB40C7Pm9ibcODAxoo',
};

@Component({
  selector: 'app-my-patients',
  imports: [RouterLink, FormsModule],
  templateUrl: './my-patients.html',
  styleUrl: './my-patients.css',
  host: { class: 'bg-gray-50 text-slate-800 font-sans antialiased' },
})
export class MyPatientsPage {
  protected readonly patients = inject(PatientService);
  private readonly bookings = inject(BookingService);

  protected readonly search = signal('');
  protected readonly status = signal<'All Status' | 'Active' | 'Inactive'>('All Status');
  protected readonly sort = signal<'Recently Added' | 'Name (A-Z)'>('Recently Added');
  protected readonly showAdd = signal(false);
  protected readonly draft = signal({ name: '', gender: 'Male' as 'Male' | 'Female', age: null as number | null, mobile: '' });

  protected readonly stats = computed(() => {
    const c = this.bookings.counts();
    return { total: this.patients.patients().length, active: c.confirmed + c['in-progress'], upcoming: c.pending, completed: c.completed };
  });

  protected readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    const list = this.patients.patients().filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) && (st === 'All Status' || p.status === st));
    return this.sort() === 'Name (A-Z)' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  });

  constructor(title: Title) {
    title.setTitle('CareGo+ | My Patients');
  }

  protected photo(id: string): string {
    return PATIENT_PHOTOS[id] ?? 'assets/patient.jpg';
  }

  protected updateDraft(patch: Partial<{ name: string; gender: 'Male' | 'Female'; age: number | null; mobile: string }>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  protected addPatient(): void {
    const d = this.draft();
    if (d.name.trim().length < 2 || !d.age) return;
    this.patients.add({
      name: d.name.trim(), gender: d.gender, age: d.age, status: 'Active', mobile: d.mobile || '—',
      bookingLabel: 'Upcoming Booking', bookingService: 'No booking yet', bookingId: '—', nextServiceLabel: 'Next Service', nextService: 'Not scheduled',
    });
    this.draft.set({ name: '', gender: 'Male', age: null, mobile: '' });
    this.showAdd.set(false);
  }
}
