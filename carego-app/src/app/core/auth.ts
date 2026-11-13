import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Account, Role } from './models';
import { Store } from './store';
import { authenticate, findAccount, registerAccount, submitKyc } from './domain/engine';

const KEY = 'carego.session';

interface Session {
  accountId: string;
  role: Role;
}

function restore(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Demo authentication: accounts live in the browser store. A real backend must hash passwords and issue tokens. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(restore());

  readonly account = computed<Account | null>(() => {
    const s = this.session();
    return s ? findAccount(this.store.db(), s.accountId) ?? null : null;
  });
  readonly role = computed<Role | null>(() => (this.account() ? this.session()!.role : null));
  readonly isLoggedIn = computed(() => !!this.account());
  readonly caregiverId = computed(() => this.account()?.caregiverId ?? null);
  readonly caregiver = computed(() => {
    const id = this.caregiverId();
    return id ? this.store.db().caregivers.find((c) => c.id === id) ?? null : null;
  });
  readonly kycVerified = computed(() => this.account()?.kyc.status === 'verified');

  /** Where each role lands after signing in. */
  home(role: Role): string {
    return role === 'admin' ? '/admin' : role === 'caregiver' ? '/caregiver/schedule' : '/app/bookings';
  }

  login(identifier: string, password: string, remember: boolean, preferred?: Role): Account | null {
    const acc = authenticate(this.store.db(), identifier, password);
    if (!acc) return null;
    const role = preferred && acc.roles.includes(preferred) ? preferred : acc.roles[0];
    this.setSession({ accountId: acc.id, role }, remember);
    return acc;
  }

  register(name: string, identifier: string, password: string): Account {
    const acc = this.store.actOrThrow((db, now) => registerAccount(db, name, identifier, password, now));
    this.setSession({ accountId: acc.id, role: 'user' }, true);
    return acc;
  }

  /** Caregivers can also book care for their own family, so they can flip between portals. */
  switchRole(role: Role): void {
    const acc = this.account();
    if (!acc || !acc.roles.includes(role)) return;
    this.setSession({ accountId: acc.id, role }, true);
    this.router.navigateByUrl(this.home(role));
  }

  canSwitchTo(role: Role): boolean {
    return !!this.account()?.roles.includes(role);
  }

  completeKyc(nid: string, selfieName: string): void {
    const id = this.account()?.id;
    if (!id) return;
    this.store.actOrThrow((db, now) => submitKyc(db, id, nid, selfieName, now));
  }

  logout(): void {
    this.session.set(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    this.router.navigateByUrl('/');
  }

  private setSession(s: Session, remember: boolean): void {
    this.session.set(s);
    try {
      if (remember) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
}
