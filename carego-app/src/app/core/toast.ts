import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  success(text: string): void { this.push('success', text); }
  error(text: string): void { this.push('error', text, 6000); }
  info(text: string): void { this.push('info', text); }

  dismiss(id: number): void {
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], text: string, ms = 3800): void {
    const id = ++this.seq;
    this.toasts.update((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
