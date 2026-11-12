import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './about.html',
  styleUrl: './about.css',
  host: { class: 'bg-white text-gray-800' },
})
export class AboutPage {
  constructor(title: Title) {
    title.setTitle('About Us - CareGo+');
  }
}
