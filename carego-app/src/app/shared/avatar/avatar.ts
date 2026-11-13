import { Component, computed, input, signal } from '@angular/core';

/** Photo with a graceful initials fallback, so a missing or broken image never leaves an empty hole. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (photo() && !failed()) {
      <img [src]="photo()" [alt]="name()" class="w-full h-full object-cover" (error)="failed.set(true)" />
    } @else {
      <span class="select-none">{{ initials() }}</span>
    }
  `,
  host: { class: 'inline-flex items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0 text-sm' },
})
export class Avatar {
  readonly photo = input<string | null | undefined>(null);
  readonly name = input('');
  protected readonly failed = signal(false);
  protected readonly initials = computed(() =>
    this.name().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?');
}
