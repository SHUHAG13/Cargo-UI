import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Db } from './models';
import { DomainError, tick } from './domain/engine';
import { createSeedDb, DB_VERSION } from './domain/seed';
import { tickConsultations } from './domain/consult';
import { ToastService } from './toast';

const KEY = 'carego.db';

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    /* corrupt or unavailable storage: fall through to a fresh seed */
  }
  return createSeedDb(new Date());
}

/**
 * The single source of truth for every record in the app.
 * State changes only go through `act()`, which runs a domain-engine function on a copy, so a rule
 * violation can never leave the data half-updated.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly toasts = inject(ToastService);
  private readonly _db = signal<Db>(load());
  /** Wall clock, refreshed every 30s so countdowns and "pending clearance" stay current. */
  readonly now = signal(new Date());

  readonly db = this._db.asReadonly();
  readonly today = computed(() => {
    const d = this.now();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  constructor() {
    this.housekeeping();
    effect(() => {
      const db = this._db();
      try {
        localStorage.setItem(KEY, JSON.stringify(db));
      } catch {
        /* storage full or blocked: the app keeps working in memory */
      }
    });
    setInterval(() => {
      this.now.set(new Date());
      this.housekeeping();
    }, 30000);
  }

  private housekeeping(): void {
    const copy = structuredClone(this._db());
    const now = new Date();
    const booked = tick(copy, now);
    if (tickConsultations(copy, now) || booked) this._db.set(copy);
  }

  /**
   * Run a domain action. On success the new state is committed and the result returned;
   * on a business-rule violation the message is shown as a toast and `undefined` is returned.
   */
  act<T>(fn: (db: Db, now: Date) => T, success?: string): T | undefined {
    const now = new Date();
    const copy = structuredClone(this._db());
    try {
      const result = fn(copy, now);
      this._db.set(copy);
      this.now.set(now);
      if (success) this.toasts.success(success);
      return result;
    } catch (e) {
      if (e instanceof DomainError) {
        this.toasts.error(e.message);
        return undefined;
      }
      throw e;
    }
  }

  /** Same as `act` but throws the DomainError so a form can show the message inline. */
  actOrThrow<T>(fn: (db: Db, now: Date) => T): T {
    const now = new Date();
    const copy = structuredClone(this._db());
    const result = fn(copy, now);
    this._db.set(copy);
    this.now.set(now);
    return result;
  }

  /** Wipe local data and rebuild the demo dataset. */
  reset(): void {
    this._db.set(createSeedDb(new Date()));
    this.now.set(new Date());
    this.toasts.success('Demo data has been reset.');
  }
}
