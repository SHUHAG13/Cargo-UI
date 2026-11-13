import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth';
import { Store } from './store';
import { ToastService } from './toast';
import { addSessionNote, checkIn, checkOut, logCash, requestHandover, setVitals } from './domain/engine';

/** One-shot GPS fix for a check-in. The shift still starts if the browser or the caregiver declines location access. */
function position(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 }),
      () => resolve(undefined),
      { timeout: 4000, maximumAge: 60000 },
    );
  });
}

/** Caregiver actions on a shift. Each returns true when the business rules allowed it (otherwise the reason is toasted). */
@Injectable({ providedIn: 'root' })
export class ShiftActions {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  private get me(): string {
    return this.auth.caregiverId() ?? '';
  }

  async checkIn(sessionId: string): Promise<boolean> {
    const geo = await position();
    const ok = this.store.act((db, now) => { checkIn(db, sessionId, this.me, now, geo); return true; });
    if (ok) this.toasts.success(geo ? 'Checked in. Your location was recorded.' : 'Checked in. (Location was not available.)');
    return !!ok;
  }

  checkOut(sessionId: string): boolean {
    return !!this.store.act((db, now) => { checkOut(db, sessionId, this.me, now); return true; }, 'Shift ended. Your earning has been credited.');
  }

  logCash(sessionId: string, amount: number): boolean {
    return !!this.store.act((db, now) => { logCash(db, sessionId, this.me, amount, now); return true; }, 'Cash recorded. It will be verified by CareGo+.');
  }

  addNote(sessionId: string, text: string): boolean {
    return !!this.store.act((db, now) => { addSessionNote(db, sessionId, this.me, text, now); return true; }, 'Note added.');
  }

  setVitals(sessionId: string, vitals: { bp: string; pulse: number; spo2: number }): boolean {
    return !!this.store.act((db, now) => { setVitals(db, sessionId, this.me, vitals, now); return true; }, 'Vitals saved.');
  }

  requestHandover(sessionId: string, toId: string): boolean {
    return !!this.store.act((db, now) => { requestHandover(db, sessionId, this.me, toId, now); return true; }, 'Handover requested. CareGo+ will confirm it.');
  }
}
