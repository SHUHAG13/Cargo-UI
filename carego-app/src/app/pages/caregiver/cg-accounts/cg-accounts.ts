import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-cg-accounts',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cg-accounts.html',
  styleUrl: './cg-accounts.css',
  host: { class: 'bg-surface text-text-main antialiased overflow-x-hidden' },
})
export class CgAccountsPage {
  constructor(title: Title) {
    title.setTitle('CareGo+ | Accounts &amp; Ledger');
  }
}
