import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { CONCERNS, DOCTORS, INSTANT_OFFERS, SPECIALTIES } from '../../../core/domain/doctors';
import { doctorsIn } from '../../../core/domain/consult';
import { Avatar } from '../../../shared/avatar/avatar';
import { DoctorCard } from '../../../shared/doctor-card/doctor-card';
import { FeaturedDoctor } from '../../../shared/featured-doctor/featured-doctor';

type Sort = 'recommended' | 'fee' | 'experience' | 'rating';

/** Doctor Consultation landing: instant offers, specialties, health concerns and the searchable doctor list. */
@Component({
  selector: 'app-doctors',
  imports: [FormsModule, RouterLink, Avatar, DoctorCard, FeaturedDoctor],
  templateUrl: './doctors.html',
})
export class DoctorsPage {
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly specialties = SPECIALTIES;
  protected readonly offers = INSTANT_OFFERS;
  protected readonly concerns = CONCERNS;
  protected readonly online = DOCTORS.filter((d) => d.online);
  protected readonly steps = [
    { icon: 'fa-user-doctor', title: 'Choose a doctor', text: 'Search by specialty, symptom or name.' },
    { icon: 'fa-calendar-check', title: 'Pick a time & pay', text: 'Instant call or a scheduled slot. Pay by bKash, Nagad, Rocket or card.' },
    { icon: 'fa-video', title: 'Join the video call', text: 'From My Consultations, 15 minutes before your slot.' },
    { icon: 'fa-file-prescription', title: 'Get your prescription', text: 'Digital prescription right after the call, plus follow-up.' },
  ];
  protected readonly faqs = [
    { q: 'How does a video consultation work?', a: 'Pick a doctor and a time, pay online, and join the video call from My Consultations when the room opens (15 minutes before your slot). Instant consultations connect you right away.' },
    { q: 'Will I get a prescription?', a: 'Yes. Your digital prescription appears in My Consultations as soon as the doctor ends the call. You can print it or show it at any pharmacy.' },
    { q: 'Is the follow-up free?', a: 'Each doctor shows their follow-up window and fee. Many follow-ups are free when booked within the window shown on the doctor’s profile.' },
    { q: 'Can I cancel an appointment?', a: 'Yes, up to 1 hour before the start time from My Consultations. The full fee is refunded to the method you paid with.' },
    { q: 'Can I book for a family member?', a: 'Yes. Choose any patient saved on your account, or consult for yourself.' },
  ];

  protected readonly search = signal('');
  protected readonly specialty = signal('all');
  protected readonly mode = signal<'any' | 'video' | 'chamber'>('any');
  protected readonly onlineOnly = signal(false);
  protected readonly sort = signal<Sort>('recommended');

  protected readonly doctors = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sp = this.specialty();
    const concernSpecialties = new Set(CONCERNS.filter((c) => q && c.label.toLowerCase().includes(q)).map((c) => c.specialtyId));
    const list = DOCTORS.filter((d) => {
      const s = SPECIALTIES.find((x) => x.id === d.specialtyId)!;
      const text = `${d.name} ${d.designation} ${s.name} ${s.blurb} ${d.workplace} ${d.degrees.join(' ')}`.toLowerCase();
      return (sp === 'all' || d.specialtyId === sp)
        && (this.mode() === 'any' || d.modes.includes(this.mode() as 'video' | 'chamber'))
        && (!this.onlineOnly() || d.online)
        && (!q || text.includes(q) || concernSpecialties.has(d.specialtyId));
    });
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      recommended: (a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(b.online) - Number(a.online) || b.rating - a.rating || b.visits - a.visits,
      fee: (a, b) => a.fee - b.fee,
      experience: (a, b) => b.experienceYears - a.experienceYears,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    };
    return [...list].sort(by[this.sort()]);
  });

  protected readonly count = (specialtyId: string) => doctorsIn(specialtyId).length;

  constructor(title: Title, route: ActivatedRoute) {
    title.setTitle('CareGo+ | Doctor Consultation');
    const sp = route.snapshot.queryParamMap.get('specialty');
    if (sp && SPECIALTIES.some((s) => s.id === sp)) this.specialty.set(sp);
  }

  protected pickSpecialty(id: string): void {
    this.specialty.set(id);
    this.search.set('');
    this.scrollToList();
  }

  protected find(): void {
    this.specialty.set('all');
    this.scrollToList();
  }

  protected reset(): void {
    this.search.set('');
    this.specialty.set('all');
    this.mode.set('any');
    this.onlineOnly.set(false);
    this.sort.set('recommended');
  }

  private scrollToList(): void {
    this.list()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
