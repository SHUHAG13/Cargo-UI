import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FeaturedDoctor } from '../../../shared/featured-doctor/featured-doctor';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FeaturedDoctor],
  templateUrl: './home.html',
  styleUrl: './home.css',
  host: { class: 'bg-slate-50 text-brand-dark overflow-x-hidden' },
})
export class HomePage {
  constructor(title: Title) {
    title.setTitle('CareGo+ | Professional Care, Right at Home');
  }
}
