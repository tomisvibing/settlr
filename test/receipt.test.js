import { describe, it, expect } from 'vitest';
import { receiptPath, pathIsPdf, fitWithin, acceptedType, isPdf, sizeLabel } from '../src/lib/receipt.js';

describe('receipts', () => {
  it('files receipts under their group, so the storage policy can check membership', () => {
    expect(receiptPath('g-1', 'f-2', 'image/jpeg')).toBe('g-1/f-2.jpg');
    expect(receiptPath('g-1', 'f-2', 'application/pdf')).toBe('g-1/f-2.pdf');
  });
  it('tells PDFs from photos by type and by path', () => {
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('image/png')).toBe(false);
    expect(pathIsPdf('g/f.PDF')).toBe(true);
    expect(pathIsPdf('g/f.jpg')).toBe(false);
    expect(pathIsPdf(null)).toBe(false);
  });
  it('accepts photos and PDFs only', () => {
    for(const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']) expect(acceptedType(t)).toBe(true);
    for(const t of ['text/plain', 'image/gif', '', 'video/mp4']) expect(acceptedType(t)).toBe(false);
  });
  it('shrinks the long edge to the limit and never enlarges', () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('labels sizes the way people read them', () => {
    expect(sizeLabel(300)).toBe('1 KB');
    expect(sizeLabel(250 * 1024)).toBe('250 KB');
    expect(sizeLabel(3.4 * 1024 * 1024)).toBe('3.4 MB');
  });
});
