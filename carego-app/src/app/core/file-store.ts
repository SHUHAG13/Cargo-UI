import { Injectable } from '@angular/core';

const DB = 'carego-files';
const STORE = 'files';

/** Keeps uploaded patient documents in IndexedDB (localStorage is far too small for PDFs and scans). */
@Injectable({ providedIn: 'root' })
export class FileStore {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(key: string, blob: Blob): Promise<void> {
    await this.tx('readwrite', (s) => s.put(blob, key));
  }

  async get(key: string): Promise<Blob | undefined> {
    try {
      return (await this.tx<Blob | undefined>('readonly', (s) => s.get(key))) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async delete(key: string): Promise<void> {
    try { await this.tx('readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
  }

  /** A one-page placeholder PDF for the demo documents that were seeded without real file content. */
  samplePdf(title: string): Blob {
    const text = `${title} (sample demo document)`.replace(/[()\\]/g, '');
    const stream = `BT /F1 18 Tf 60 740 Td (${text}) Tj ET`;
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }
}
