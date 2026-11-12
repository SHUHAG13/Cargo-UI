import { Component, computed, effect, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

type ServiceTab = 'caregiver' | 'nursing' | 'nanny';

const SUBTITLES: Record<ServiceTab, string> = {
  caregiver: 'Compare our home caregiver packages and choose the right care for your loved one.',
  nursing: 'Compare our home nursing packages and choose the right care for your loved one.',
  nanny: 'Compare our home care packages and choose the right care for your loved one.',
};

/** Services & Packages comparison. /services/:tab deep-links a tab (replaces homeCareGiver / homeNursing / nanyService pages). */
@Component({
  selector: 'app-services',
  imports: [RouterLink],
  templateUrl: './services.html',
  styleUrl: './services.css',
  host: { class: 'bg-white text-carego-dark font-sans antialiased' },
})
export class ServicesPage {
  /** Route param bound via withComponentInputBinding. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });
  protected readonly tab = signal<ServiceTab>('caregiver');
  protected readonly subtitle = computed(() => SUBTITLES[this.tab()]);

  constructor(title: Title, private readonly router: Router) {
    title.setTitle('CareGo+ Services & Packages');
    effect(() => {
      const p = this.tabParam();
      if (p === 'caregiver' || p === 'nursing' || p === 'nanny') this.tab.set(p);
    });
  }

  protected selectTab(t: ServiceTab): void {
    this.tab.set(t);
    this.router.navigate(['/services', t], { replaceUrl: true });
  }
}
