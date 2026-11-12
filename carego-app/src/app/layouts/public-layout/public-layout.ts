import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Marketing site + auth pages: sticky header, page, site footer. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './public-layout.html',
  host: { class: 'bg-slate-50 text-brand-dark overflow-x-hidden' },
})
export class PublicLayout {}
