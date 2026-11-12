import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-contact',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
  host: { class: 'text-neutralDark' },
})
export class ContactPage {
  constructor(title: Title) {
    title.setTitle('Contact Us - CareGo+');
  }
}
