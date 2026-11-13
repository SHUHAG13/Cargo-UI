import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[22rem] max-w-[calc(100vw-2rem)]" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm bg-white"
             [class.border-emerald-200]="t.kind === 'success'" [class.border-red-200]="t.kind === 'error'" [class.border-sky-200]="t.kind === 'info'">
          <i class="mt-0.5 fa-solid" [class.fa-circle-check]="t.kind === 'success'" [class.text-emerald-600]="t.kind === 'success'"
             [class.fa-circle-exclamation]="t.kind === 'error'" [class.text-red-500]="t.kind === 'error'"
             [class.fa-circle-info]="t.kind === 'info'" [class.text-sky-500]="t.kind === 'info'"></i>
          <p class="flex-1 text-slate-700">{{ t.text }}</p>
          <button type="button" class="text-slate-400 hover:text-slate-600" (click)="toasts.dismiss(t.id)" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
