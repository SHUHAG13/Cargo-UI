import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-cg-shift-details',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cg-shift-details.html',
  styleUrl: './cg-shift-details.css',
  host: { class: 'min-h-screen pb-10' },
})
export class CgShiftDetailsPage {
  constructor(title: Title) {
    title.setTitle('Shift Details - CareGo+');
  }
}
