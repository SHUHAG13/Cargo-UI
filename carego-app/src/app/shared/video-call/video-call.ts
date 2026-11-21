import { Component, computed, ElementRef, inject, input, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
import { Store } from '../../core/store';
import { Data } from '../../core/data';
import { AuthService } from '../../core/auth';
import { completeConsultation, doctorById, fullName, joinCall } from '../../core/domain/consult';
import { Avatar } from '../avatar/avatar';

/**
 * Video room for a consultation. There is no media server in this build: the doctor joins after a short "connecting" step,
 * your own camera is optional (browser permission), and ending the call completes the visit and issues the prescription.
 */
@Component({
  selector: 'app-video-call',
  imports: [Avatar],
  template: `
    @if (doctor(); as d) {
    <div class="fixed inset-0 z-[95] bg-slate-950 text-white flex flex-col" role="dialog" aria-modal="true" aria-label="Video consultation">
      <div class="flex items-center justify-between px-6 py-4">
        <div>
          <p class="font-semibold">{{ name() }}</p>
          <p class="text-xs text-white/60">{{ d.designation }} · Consultation {{ consultationId() }}</p>
        </div>
        <span class="text-sm font-mono px-3 py-1 rounded-full" [class]="connected() ? 'bg-red-500/90' : 'bg-white/10'">{{ connected() ? '● ' + elapsed() : 'Connecting…' }}</span>
      </div>

      <div class="flex-1 relative flex items-center justify-center px-6">
        <div class="w-full max-w-4xl aspect-video rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-4 border border-white/10">
          <app-avatar class="w-28 h-28 !text-3xl" [photo]="d.photo" [name]="d.name" />
          @if (connected()) {
            <p class="text-lg font-semibold">{{ name() }}</p>
            <p class="text-sm text-white/60 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>Doctor is with you</p>
          } @else {
            <p class="text-sm text-white/70">Waiting for {{ name() }} to join…</p>
          }
        </div>
        <div class="absolute bottom-4 right-8 w-44 aspect-video rounded-xl overflow-hidden bg-slate-700 border border-white/20 flex items-center justify-center">
          <video #self autoplay muted playsinline class="w-full h-full object-cover" [class.hidden]="!camOn()"></video>
          @if (!camOn()) { <span class="text-xs text-white/70"><i class="fa-solid fa-video-slash mr-1"></i>Camera off</span> }
        </div>
      </div>

      @if (camError()) { <p class="text-center text-xs text-amber-300 pb-2">{{ camError() }}</p> }
      <div class="flex items-center justify-center gap-4 py-6">
        <button type="button" (click)="muted.set(!muted())" class="w-12 h-12 rounded-full flex items-center justify-center" [class]="muted() ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20'" [attr.aria-label]="muted() ? 'Unmute' : 'Mute'"><i class="fa-solid" [class.fa-microphone]="!muted()" [class.fa-microphone-slash]="muted()"></i></button>
        <button type="button" (click)="toggleCam()" class="w-12 h-12 rounded-full flex items-center justify-center" [class]="camOn() ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-slate-900'" [attr.aria-label]="camOn() ? 'Turn camera off' : 'Turn camera on'"><i class="fa-solid" [class.fa-video]="camOn()" [class.fa-video-slash]="!camOn()"></i></button>
        <button type="button" (click)="leave()" class="px-5 h-12 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold">Leave for now</button>
        <button type="button" (click)="end()" [disabled]="!connected()" class="px-6 h-12 rounded-full bg-red-600 hover:bg-red-700 text-sm font-bold disabled:opacity-40"><i class="fa-solid fa-phone-slash mr-2"></i>End consultation</button>
      </div>
    </div>
    }
  `,
})
export class VideoCall implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly data = inject(Data);
  private readonly auth = inject(AuthService);
  private readonly selfVideo = viewChild<ElementRef<HTMLVideoElement>>('self');

  readonly consultationId = input.required<string>();
  /** 'completed' when the visit was ended, 'left' when the patient stepped out and can rejoin. */
  readonly closed = output<'completed' | 'left'>();

  protected readonly consultation = computed(() => this.data.myConsultations().find((c) => c.id === this.consultationId()));
  protected readonly doctor = computed(() => (this.consultation() ? doctorById(this.consultation()!.doctorId) : undefined));
  protected readonly name = computed(() => (this.doctor() ? fullName(this.doctor()!) : ''));

  protected readonly connected = signal(false);
  protected readonly seconds = signal(0);
  protected readonly elapsed = computed(() => `${String(Math.floor(this.seconds() / 60)).padStart(2, '0')}:${String(this.seconds() % 60).padStart(2, '0')}`);
  protected readonly muted = signal(false);
  protected readonly camOn = signal(false);
  protected readonly camError = signal('');
  private stream: MediaStream | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    const joined = this.store.act((db, now) => joinCall(db, this.auth.account()!.id, this.consultationId(), now));
    if (!joined) { this.closed.emit('left'); return; }
    this.timers.push(setTimeout(() => this.connected.set(true), 2500));
    this.timers.push(setInterval(() => { if (this.connected()) this.seconds.update((s) => s + 1); }, 1000));
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearInterval(t));
    this.stopCam();
  }

  protected async toggleCam(): Promise<void> {
    if (this.camOn()) { this.stopCam(); return; }
    this.camError.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.camOn.set(true);
      const v = this.selfVideo()?.nativeElement;
      if (v) v.srcObject = this.stream;
    } catch {
      this.camError.set('Camera is unavailable or permission was denied. You can continue with audio.');
    }
  }

  private stopCam(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.camOn.set(false);
  }

  protected leave(): void {
    this.closed.emit('left');
  }

  protected end(): void {
    if (!confirm('End this consultation? The doctor will send your prescription.')) return;
    const done = this.store.act((db, now) => completeConsultation(db, this.auth.account()!.id, this.consultationId(), now), 'Consultation completed. Your prescription is ready.');
    if (done) this.closed.emit('completed');
  }
}
