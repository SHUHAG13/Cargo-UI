import { computed, Injectable, signal } from '@angular/core';

export interface SessionUser {
  name: string;
  identifier: string;
  role: 'user' | 'caregiver';
}

const KEY = 'carego.session';
const DEMO_USER: SessionUser = { name: 'Irfan Hossain', identifier: 'irfan@example.com', role: 'user' };

/** Demo authentication: any credentials sign in as the demo customer; the session is kept in localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<SessionUser>(restore());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user().identifier);

  login(identifier: string, _password: string, remember = true): SessionUser {
    const u = { ...DEMO_USER, identifier };
    this._user.set(u);
    if (remember) persist(u);
    return u;
  }

  register(fullName: string, identifier: string): SessionUser {
    const u: SessionUser = { name: fullName, identifier, role: 'user' };
    this._user.set(u);
    persist(u);
    return u;
  }

  logout(): void {
    this._user.set(DEMO_USER);
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
}

function restore(): SessionUser {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEMO_USER, ...JSON.parse(raw) } : DEMO_USER;
  } catch {
    return DEMO_USER;
  }
}

function persist(u: SessionUser): void {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* storage unavailable */ }
}
