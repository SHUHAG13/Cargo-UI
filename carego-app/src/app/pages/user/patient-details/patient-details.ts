import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { FileStore } from '../../../core/file-store';
import { ToastService } from '../../../core/toast';
import { BdtPipe } from '../../../core/money.pipe';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { Booking, DocumentCategory, Patient, PatientDocument } from '../../../core/models';
import {
  addPatientDocument, addPatientNote, bookingPaid, DomainError, paymentsReceived, removePatientDocument, removePatientNote,
  sessionsCompleted, updatePatient, depositPaid,
} from '../../../core/domain/engine';
import { Avatar } from '../../../shared/avatar/avatar';
import { STATUS_UI } from '../../../shared/ui';

type PatientTab = 'overview' | 'bookings' | 'documents' | 'notes';

const CONDITIONS = ['Diabetes', 'Hypertension', 'Heart Disease', 'Kidney Disease', 'Asthma/COPD', 'Paralysis', 'Psychiatric illness', 'Others'];
const DOC_CATEGORIES: DocumentCategory[] = ['Discharge Summary', 'Prescriptions', 'Investigation Reports', 'ID Proofs', 'Others'];

interface Draft {
  name: string; age: number; gender: Patient['gender']; weightKg: number | null; bloodGroup: string; nidNumber: string; mobile: string; altMobile: string;
  address: string; diagnosis: string; conditions: string[]; infection: Patient['infection']; allergies: string; functional: Patient['functional'];
  primary: { name: string; relation: string; mobile: string }; secondary: { name: string; relation: string; mobile: string };
  treatingDoctor: string; hospital: string;
}

/** Patient details at /app/patients/:id with Details / Bookings / Documents / Notes tabs. */
@Component({
  selector: 'app-patient-details',
  imports: [RouterLink, FormsModule, BdtPipe, Avatar, ...FORMAT_PIPES],
  templateUrl: './patient-details.html',
  styleUrl: './patient-details.css',
  host: { class: 'flex min-h-screen text-slate-700' },
})
export class PatientDetailsPage {
  protected readonly data = inject(Data);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly files = inject(FileStore);
  private readonly toasts = inject(ToastService);
  readonly id = input.required<string>();

  protected readonly ui = STATUS_UI;
  protected readonly conditions = CONDITIONS;
  protected readonly docCategories = DOC_CATEGORIES;
  protected readonly tab = signal<PatientTab>('overview');
  protected readonly editing = signal(false);
  protected readonly error = signal('');
  protected draft!: Draft;

  // bookings tab
  protected readonly search = signal('');
  protected readonly bookingFilter = signal<'All' | 'Active' | 'Upcoming' | 'Completed' | 'Cancelled'>('All');
  protected readonly bookingSort = signal<'Recently Added' | 'Oldest'>('Recently Added');

  // documents / notes
  protected uploadCategory: DocumentCategory = 'Prescriptions';
  protected readonly showUpload = signal(false);
  protected readonly uploading = signal(false);
  protected readonly showNote = signal(false);
  protected noteTitle = '';
  protected noteText = '';

  /** A customer can only open their own patients. */
  protected readonly patient = computed(() => {
    const p = this.data.patient(this.id());
    return p && p.ownerId === this.auth.account()?.id ? p : undefined;
  });
  protected readonly status = computed(() => (this.patient() ? this.data.patientStatus(this.patient()!.id) : 'Inactive'));
  protected readonly bookings = computed(() => (this.patient() ? this.data.bookingsOfPatient(this.patient()!.id) : []));
  protected readonly latest = computed(() => this.bookings().find((b) => b.status !== 'cancelled') ?? this.bookings()[0]);
  protected readonly stats = computed(() => {
    const bs = this.bookings();
    const n = (...s: string[]) => bs.filter((b) => s.includes(b.status)).length;
    return {
      total: bs.length, active: n('in-progress'), upcoming: n('pending', 'confirmed'), completed: n('completed'),
      spent: Math.round(bs.reduce((s, b) => s + bookingPaid(b), 0) * 100) / 100,
    };
  });
  protected readonly visibleBookings = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.bookingFilter();
    const match = (b: Booking) => f === 'All' || (f === 'Active' && b.status === 'in-progress') || (f === 'Upcoming' && (b.status === 'pending' || b.status === 'confirmed'))
      || (f === 'Completed' && b.status === 'completed') || (f === 'Cancelled' && b.status === 'cancelled');
    const list = this.bookings().filter((b) => match(b) && (!q || b.id.toLowerCase().includes(q) || b.categoryName.toLowerCase().includes(q) || b.packageName.toLowerCase().includes(q)));
    return this.bookingSort() === 'Oldest' ? [...list].reverse() : list;
  });
  protected readonly docsByCategory = computed(() =>
    DOC_CATEGORIES.map((c) => ({ category: c, docs: (this.patient()?.documents ?? []).filter((d) => d.category === c) })).filter((g) => g.docs.length));
  protected hasDoc = (cat: DocumentCategory): PatientDocument | undefined => this.patient()?.documents.find((d) => d.category === cat);

  constructor(private readonly title: Title) {
    this.title.setTitle('CareGo+ | Patient Details');
  }

  // ── booking card helpers ──
  protected progress(b: Booking): { label: string; done: boolean }[] {
    return [
      { label: 'Booking Placed', done: true },
      { label: 'Confirmed', done: b.status !== 'pending' && b.status !== 'cancelled' || !!b.confirmedAt },
      { label: 'Payment Received (30%)', done: depositPaid(b) },
      { label: 'Caregiver Assigned', done: b.assigned.length > 0 },
      { label: 'Service Started', done: !!b.startedAt },
      { label: 'Service Ended', done: !!b.completedAt },
    ];
  }
  protected progressPct(b: Booking): number {
    const steps = this.progress(b);
    const done = steps.filter((s) => s.done).length;
    return Math.round(((done - 1) / (steps.length - 1)) * 100);
  }
  protected stage(b: Booking): string {
    if (b.status === 'cancelled') return 'Booking Cancelled';
    if (b.status === 'completed') return 'Service Completed';
    if (b.status === 'in-progress') return 'Service in Progress';
    if (b.assigned.length) return 'Caregiver Assigned';
    if (depositPaid(b)) return 'Payment Received';
    return b.status === 'confirmed' ? 'Awaiting Deposit' : 'Awaiting Confirmation';
  }
  protected sessions = (b: Booking): number => sessionsCompleted(this.data.db(), b.id);
  protected payments = (b: Booking): number => paymentsReceived(b);
  protected paidOf = bookingPaid;
  protected shortAddress(addr: string): string {
    const parts = addr.split(',').map((s) => s.trim());
    return parts.slice(-2).join(', ');
  }

  // ── editing ──
  protected startEdit(): void {
    const p = this.patient();
    if (!p) return;
    this.draft = {
      name: p.name, age: p.age, gender: p.gender, weightKg: p.weightKg, bloodGroup: p.bloodGroup, nidNumber: p.nidNumber, mobile: p.mobile, altMobile: p.altMobile,
      address: p.address, diagnosis: p.diagnosis, conditions: [...p.conditions], infection: { ...p.infection }, allergies: p.allergies, functional: { ...p.functional },
      primary: { ...p.primaryContact }, secondary: { ...(p.secondaryContact ?? { name: '', relation: '', mobile: '' }) }, treatingDoctor: p.treatingDoctor, hospital: p.hospital,
    };
    this.error.set('');
    this.tab.set('overview');
    this.editing.set(true);
  }

  protected toggleCondition(c: string): void {
    const i = this.draft.conditions.indexOf(c);
    if (i >= 0) this.draft.conditions.splice(i, 1);
    else this.draft.conditions.push(c);
  }

  protected saveEdit(): void {
    const p = this.patient();
    if (!p) return;
    const d = this.draft;
    try {
      this.store.actOrThrow((db) => updatePatient(db, p.id, {
        name: d.name, age: d.age, gender: d.gender, weightKg: d.weightKg, bloodGroup: d.bloodGroup, nidNumber: d.nidNumber, mobile: d.mobile, altMobile: d.altMobile,
        address: d.address, diagnosis: d.diagnosis, conditions: d.conditions, infection: d.infection, allergies: d.allergies, functional: d.functional,
        primaryContact: d.primary, secondaryContact: d.secondary.name.trim() ? d.secondary : null, treatingDoctor: d.treatingDoctor, hospital: d.hospital,
      }));
      this.editing.set(false);
      this.toasts.success('Patient information updated.');
    } catch (e) {
      this.error.set(e instanceof DomainError ? e.message : 'Could not save the changes.');
    }
  }

  // ── documents ──
  protected async upload(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const p = this.patient();
    if (!file || !p) return;
    this.uploading.set(true);
    const doc = this.store.act((db, now) => addPatientDocument(db, p.id, this.uploadCategory, { name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }, now));
    if (doc) {
      try {
        await this.files.put(doc.id, file);
        this.toasts.success(`${file.name} uploaded.`);
        this.showUpload.set(false);
      } catch {
        this.store.act((db) => removePatientDocument(db, p.id, doc.id));
        this.toasts.error('Could not store the file in this browser. Please try a smaller file.');
      }
    }
    input.value = '';
    this.uploading.set(false);
  }

  private async blobOf(d: PatientDocument): Promise<Blob> {
    return (await this.files.get(d.id)) ?? this.files.samplePdf(d.name);
  }

  protected async view(d: PatientDocument): Promise<void> {
    const url = URL.createObjectURL(await this.blobOf(d));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  protected async download(d: PatientDocument): Promise<void> {
    const url = URL.createObjectURL(await this.blobOf(d));
    const a = document.createElement('a');
    a.href = url;
    a.download = d.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  protected async removeDoc(d: PatientDocument): Promise<void> {
    const p = this.patient();
    if (!p || !confirm(`Delete ${d.name}?`)) return;
    this.store.act((db) => removePatientDocument(db, p.id, d.id), 'Document deleted.');
    await this.files.delete(d.id);
  }

  // ── notes ──
  protected addNote(): void {
    const p = this.patient();
    if (!p) return;
    const ok = this.store.act((db, now) => addPatientNote(db, p.id, this.noteTitle, this.noteText, `${this.auth.account()?.name ?? 'You'} (Family)`, now), 'Note added.');
    if (ok !== undefined) {
      this.noteTitle = '';
      this.noteText = '';
      this.showNote.set(false);
    }
  }

  protected removeNote(id: string): void {
    const p = this.patient();
    if (!p || !confirm('Delete this note?')) return;
    this.store.act((db) => removePatientNote(db, p.id, id), 'Note deleted.');
  }

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.toasts.info(`Copied ${text}`)).catch(() => undefined);
  }

  protected lastUpdated(): string {
    const p = this.patient();
    if (!p) return '';
    const stamps = [...p.notes.map((n) => n.at), ...p.documents.map((d) => d.uploadedAt)].sort();
    return stamps.length ? stamps[stamps.length - 1] : '';
  }
}
