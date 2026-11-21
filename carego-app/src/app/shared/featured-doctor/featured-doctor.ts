import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FEATURED_DOCTOR } from '../../core/domain/doctors';
import { specialtyById } from '../../core/domain/consult';

/** Spotlight for the featured doctor, shown on the home page and at the top of Doctor Consultation. */
@Component({
  selector: 'app-featured-doctor',
  imports: [RouterLink, DecimalPipe],
  template: `
    @if (doctor; as d) {
    <div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden grid md:grid-cols-[260px_1fr]">
      <div class="bg-gradient-to-br from-brand-teal-light to-white flex items-center justify-center p-6">
        <img [src]="d.photo" [alt]="d.name" class="w-48 h-48 md:w-52 md:h-52 rounded-full object-cover shadow-md ring-4 ring-white" />
      </div>
      <div class="p-6 md:p-8 flex flex-col justify-center">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-white bg-brand-teal px-2.5 py-1 rounded-full"><i class="fa-solid fa-star mr-1"></i>Featured doctor</span>
          @if (d.online) { <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">● Online now</span> }
          <span class="text-[11px] font-bold text-brand-teal bg-brand-teal-light px-2.5 py-1 rounded-full">{{ d.experienceYears }}+ years experience</span>
        </div>
        <h3 class="mt-3 text-2xl font-bold text-carego-dark">{{ d.name }}</h3>
        <p class="text-sm text-carego-gray">{{ d.degrees.join(', ') }}</p>
        @if (d.headline) { <p class="mt-3 text-sm text-carego-dark leading-relaxed">{{ d.headline }}</p> }
        <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span class="font-semibold text-brand-teal"><i class="fa-solid {{ specialty?.icon }} mr-1.5"></i>{{ d.designation }}</span>
          <span class="text-carego-gray"><i class="fa-regular fa-hospital text-brand-teal mr-1.5"></i>{{ d.workplace }}</span>
          <span class="text-carego-gray"><i class="fa-solid fa-star text-amber-400 mr-1"></i><b class="text-carego-dark">{{ d.rating }}</b> ({{ d.reviews | number }}) · {{ d.visits | number }} visits</span>
        </div>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <p class="text-2xl font-bold text-carego-dark mr-2">@if (d.listFee) { <span class="text-sm font-normal text-carego-gray line-through mr-1">৳{{ d.listFee }}</span> }৳{{ d.fee }}<span class="text-xs font-normal text-carego-gray"> / consultation</span></p>
          @if (d.online) {
            <a routerLink="/app/consultations/book" [queryParams]="{ doctor: d.id, instant: 1 }" class="px-5 py-2.5 rounded-lg bg-brand-teal text-white text-sm font-bold hover:bg-brand-teal-dark transition"><i class="fa-solid fa-video mr-2"></i>See Doctor Now</a>
          }
          <a [routerLink]="['/doctors', d.id]" class="px-5 py-2.5 rounded-lg border border-brand-teal text-brand-teal text-sm font-bold hover:bg-brand-teal-light transition">Book Appointment</a>
          @if (showAll()) { <a routerLink="/doctors" class="text-sm font-semibold text-brand-teal hover:underline">View all doctors →</a> }
        </div>
      </div>
    </div>
    }
  `,
  host: { class: 'block' },
})
export class FeaturedDoctor {
  /** Adds a "View all doctors" link (used on the home page). */
  readonly showAll = input(false);
  protected readonly doctor = FEATURED_DOCTOR;
  protected readonly specialty = FEATURED_DOCTOR ? specialtyById(FEATURED_DOCTOR.specialtyId) : undefined;
}
