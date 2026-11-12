import { Pipe, PipeTransform } from '@angular/core';

/** Formats BDT the way the prototype does: "৳ 47,250.00" (lakh grouping as in "৳ 1,10,250.00"). */
@Pipe({ name: 'bdt' })
export class BdtPipe implements PipeTransform {
  private readonly fmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  transform(value: number | null | undefined, options: { sign?: boolean; space?: boolean } = {}): string {
    const n = value ?? 0;
    const space = options.space === false ? '' : ' ';
    const sign = options.sign && n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}৳${space}${this.fmt.format(Math.abs(n))}`;
  }
}
