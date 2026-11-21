import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Doctor } from '../../core/models';
import { fullName, specialtyById } from '../../core/domain/consult';
import { Avatar } from '../avatar/avatar';

/** Doctor summary used in listings: who they are, fee, and the two ways to consult. */
@Component({
  selector: 'app-doctor-card',
  imports: [RouterLink, Avatar, DecimalPipe],
  template: `
    @let d = doctor();
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col h-full hover:shadow-md hover:border-brand-teal/40 transition">
      <div class="flex gap-4">
        <div class="relative shrink-0">
          <app-avatar class="w-16 h-16 !text-lg" [photo]="d.photo" [name]="d.name" />
          @if (d.online) { <span class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" title="Online now"></span> }
        </div>
        <div class="min-w-0 flex-1">
          <span class="inline-block text-[11px] font-bold text-brand-teal bg-brand-teal-light px-2 py-0.5 rounded-full">{{ d.experienceYears }}+ years experience</span>
          <a [routerLink]="['/doctors', d.id]" class="block mt-1 font-bold text-carego-dark leading-tight hover:text-brand-teal">{{ name() }}</a>
          <p class="text-xs text-carego-gray mt-0.5 line-clamp-2">{{ d.degrees.join(', ') }}</p>
        </div>
      </div>

      <div class="mt-4 mb-4 space-y-1.5 text-sm">
        <p class="font-semibold text-carego-dark"><i class="fa-solid {{ specialty()?.icon }} text-brand-teal w-5"></i>{{ d.designation }}</p>
        <p class="text-carego-gray text-xs flex gap-1"><i class="fa-regular fa-hospital text-brand-teal w-5 mt-0.5"></i><span class="line-clamp-2">{{ d.workplace }}</span></p>
        <p class="text-xs text-carego-gray"><i class="fa-solid fa-star text-amber-400 w-5"></i><span class="font-bold text-carego-dark">{{ d.rating }}</span> ({{ d.reviews | number }}) · {{ d.visits | number }} visits completed</p>
      </div>

      <div class="mt-auto pt-4 border-t border-gray-100 space-y-3">
        <div class="flex items-baseline justify-between">
          <p class="text-[11px] font-bold uppercase tracking-wider text-carego-gray">Per consultation</p>
          <p class="text-lg font-bold text-carego-dark">@if (d.listFee) { <span class="text-sm font-normal text-carego-gray line-through mr-1">৳{{ d.listFee | number }}</span> }৳{{ d.fee | number }}</p>
        </div>
        <div class="flex gap-2">
          @if (d.online) {
            <a routerLink="/app/consultations/book" [queryParams]="{ doctor: d.id, instant: 1 }" class="flex-1 text-center px-3 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-brand-teal-dark transition">See Doctor Now</a>
          }
          <a [routerLink]="['/doctors', d.id]" [class]="(d.online ? 'border border-brand-teal text-brand-teal hover:bg-brand-teal-light' : 'bg-brand-teal text-white hover:bg-brand-teal-dark') + ' flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold transition'">Book Appointment</a>
        </div>
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class DoctorCard {
  readonly doctor = input.required<Doctor>();
  protected readonly name = computed(() => fullName(this.doctor()));
  protected readonly specialty = computed(() => specialtyById(this.doctor().specialtyId));
}
