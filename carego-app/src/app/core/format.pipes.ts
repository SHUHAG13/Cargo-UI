import { Pipe, PipeTransform } from '@angular/core';
import { dateTimeLabel, clock } from './domain/engine';
import { fmtDay, fmtLongDay } from './domain/catalog';

/** "2026-05-25" → "25 May 2026" */
@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(iso: string | null | undefined, long = false): string {
    return iso ? (long ? fmtLongDay(iso) : fmtDay(iso)) : '—';
  }
}

/** ISO instant → "24 May 2026, 09:15 AM" */
@Pipe({ name: 'dt' })
export class DateTimePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? dateTimeLabel(iso) : '—';
  }
}

/** ISO instant → "09:15 AM" */
@Pipe({ name: 'clock' })
export class ClockPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? clock(iso) : '—';
  }
}

/** ISO instant → "24 May 2026" */
@Pipe({ name: 'dateOnly' })
export class DateOnlyPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }
}

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}

export const FORMAT_PIPES = [DayPipe, DateTimePipe, ClockPipe, DateOnlyPipe, FileSizePipe] as const;
