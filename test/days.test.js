import { describe, it, expect } from 'vitest';
import { dayLabel, byDay } from '../src/lib/days.js';

const now = new Date('2026-10-01T15:00:00').getTime();   /* a Thursday */

describe('receipt day headings', () => {
  it('names recent days and dates the rest', () => {
    expect(dayLabel('2026-10-01', now)).toBe('Today');
    expect(dayLabel('2026-09-30', now)).toBe('Yesterday');
    expect(dayLabel('2026-09-26', now)).toBe('Saturday');
    expect(dayLabel('2026-09-15', now)).toBe('15 September');
    expect(dayLabel('2025-12-24', now)).toBe('24 December 2025');
  });
  it('cuts a newest-first list into days', () => {
    const items = [{ d: '2026-10-01' }, { d: '2026-10-01' }, { d: '2026-09-30' }, { d: '2026-09-15' }];
    expect(byDay(items, x => x.d, now).map(g => [g.label, g.items.length])).toEqual([['Today', 2], ['Yesterday', 1], ['15 September', 1]]);
  });
});
