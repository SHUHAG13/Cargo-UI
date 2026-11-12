import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './home.html',
  styleUrl: './home.css',
  host: { class: 'bg-slate-50 text-brand-dark overflow-x-hidden' },
})
export class HomePage {
  constructor(title: Title) {
    title.setTitle('CareGo+ | Professional Care, Right at Home');
  }
}
