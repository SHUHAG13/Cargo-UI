import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-cg-schedule',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cg-schedule.html',
  styleUrl: './cg-schedule.css',
  host: { class: 'pb-20' },
})
export class CgSchedulePage {
  constructor(title: Title) {
    title.setTitle('CareGo+ - My Schedule');
  }
}
