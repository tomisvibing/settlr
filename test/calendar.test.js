import { describe, it, expect } from 'vitest';
import { parseYmd, addDays, shiftMonth, monthGrid, dateLabel } from '../src/lib/calendar.js';

describe('calendar', () => {
  it('parses real dates only', () => {
    expect(parseYmd('2026-09-13')).toEqual({ y: 2026, m: 8, d: 13 });
    expect(parseYmd('2026-02-30')).toBeNull();
    expect(parseYmd('13/09/2026')).toBeNull();
    expect(parseYmd('')).toBeNull();
  });
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('shifts months across years', () => {
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
  });
  it('lays a month out in whole Monday-first weeks', () => {
    const weeks = monthGrid(2026, 8); /* September 2026 starts on a Tuesday */
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe('2026-08-31');
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][1]).toEqual({ date: '2026-09-01', day: 1, inMonth: true });
    expect(weeks.flat().filter(c => c.inMonth)).toHaveLength(30);
    expect(weeks.at(-1).at(-1).date).toBe('2026-10-04');
  });
  it('needs no padding week when a month fits exactly', () => {
    const weeks = monthGrid(2027, 1); /* February 2027: Monday 1st, 28 days */
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].date).toBe('2027-02-01');
  });
  it('labels today, yesterday and other days', () => {
    const now = new Date(2026, 8, 13, 15, 0);
    expect(dateLabel('2026-09-13', now)).toBe('Today');
    expect(dateLabel('2026-09-12', now)).toBe('Yesterday');
    expect(dateLabel('2026-08-01', now)).toBe('Sat 1 Aug');
    expect(dateLabel('2025-12-25', now)).toBe('Thu 25 Dec 2025');
    expect(dateLabel('nope', now)).toBe('Pick a date');
  });
});
