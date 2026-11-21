import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Data } from '../../../core/data';
import { Store } from '../../../core/store';
import { AuthService } from '../../../core/auth';
import { canCancel, canJoin, cancelConsultation, doctorById, followUpDeadline, followUpOpen, fullName, JOIN_EARLY_MINS, specialtyById } from '../../../core/domain/consult';
import { FORMAT_PIPES } from '../../../core/format.pipes';
import { Avatar } from '../../../shared/avatar/avatar';
import { VideoCall } from '../../../shared/video-call/video-call';
import { CONSULT_STATUS } from '../consultations/consultations';

/** One consultation: appointment, video room, payment receipt and the doctor's prescription. */
@Component({
  selector: 'app-consult-details',
  imports: [RouterLink, Avatar, VideoCall, ...FORMAT_PIPES],
  templateUrl: './consult-details.html',
})
export class ConsultDetailsPage {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly data = inject(Data);

  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly justBooked = this.route.snapshot.queryParamMap.has('booked');
  protected readonly joinEarly = JOIN_EARLY_MINS;

  protected readonly c = computed(() => this.data.myConsultations().find((x) => x.id === this.id));
  protected readonly doctor = computed(() => (this.c() ? doctorById(this.c()!.doctorId) : undefined));
  protected readonly name = computed(() => (this.doctor() ? fullName(this.doctor()!) : ''));
  protected readonly specialty = computed(() => (this.doctor() ? specialtyById(this.doctor()!.specialtyId) : undefined));
  protected readonly status = computed(() => (this.c() ? CONSULT_STATUS[this.c()!.status] : null));
  protected readonly joinable = computed(() => !!this.c() && canJoin(this.data.db(), this.c()!, this.data.now()));
  protected readonly cancellable = computed(() => !!this.c() && canCancel(this.c()!, this.data.now()));
  protected readonly followUp = computed(() => !!this.c() && followUpOpen(this.data.db(), this.c()!, this.data.now()));
  protected readonly followUpBy = computed(() => (this.c() ? followUpDeadline(this.c()!) : null));
  protected readonly original = computed(() => (this.c()?.followUpOf ? this.data.myConsultations().find((x) => x.id === this.c()!.followUpOf) : undefined));

  protected readonly inCall = signal(false);

  constructor(title: Title) {
    title.setTitle(`CareGo+ | Consultation ${this.id}`);
    if (this.route.snapshot.queryParamMap.has('join') && this.joinable()) this.inCall.set(true);
  }

  protected callClosed(how: 'completed' | 'left'): void {
    this.inCall.set(false);
    // Drop ?join so a refresh does not reopen the call.
    this.router.navigate([], { queryParams: {}, replaceUrl: true, fragment: how === 'completed' ? 'prescription' : undefined });
    if (how === 'completed') setTimeout(() => document.getElementById('prescription')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  protected cancel(): void {
    const c = this.c()!;
    if (!confirm(`Cancel this consultation?${c.payment ? ` ৳${c.fee} will be refunded to your ${c.payment.method}.` : ''}`)) return;
    this.store.act((db, now) => cancelConsultation(db, this.auth.account()!.id, c.id, now), 'Consultation cancelled. Your refund is on its way.');
  }

  protected print(): void {
    window.print();
  }
}
