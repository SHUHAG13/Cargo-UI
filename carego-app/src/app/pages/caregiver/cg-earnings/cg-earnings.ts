import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-cg-earnings',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cg-earnings.html',
  styleUrl: './cg-earnings.css',
  host: { class: 'bg-background text-on-background' },
})
export class CgEarningsPage {
  constructor(title: Title) {
    title.setTitle('CareGo+ | Earnings Portal');
  }
}
