import { describe, it, expect } from 'vitest';
import { dueDate, firstRepeat, nextDate, frequencyLabel } from '../src/lib/recurring.js';

describe('recurring dates', () => {
  it('steps by weeks and fortnights', () => {
    expect(dueDate('2026-10-01', 'weekly', 2)).toBe('2026-10-15');
    expect(dueDate('2026-12-30', 'fortnightly', 1)).toBe('2027-01-13');
  });
  it('keeps a month-end bill on the last day it can, then returns to the 31st', () => {
    expect(dueDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(dueDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
    expect(dueDate('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
    expect(dueDate('2026-11-15', 'monthly', 3)).toBe('2027-02-15');
  });
  it('repeats yearly, including 29 February', () => {
    expect(dueDate('2026-10-01', 'yearly', 1)).toBe('2027-10-01');
    expect(dueDate('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
  });
  it('starts repeating after the expense you’re adding, which covers the first one', () => {
    expect(firstRepeat('2026-10-01', 'monthly')).toBe('2026-11-01');
  });
  it('knows when a schedule next runs, or that it has ended', () => {
    const r = { startDate: '2026-11-01', frequency: 'monthly', runs: 2, endsOn: null };
    expect(nextDate(r)).toBe('2027-01-01');
    expect(nextDate({ ...r, endsOn: '2026-12-31' })).toBeNull();
  });
  it('words the frequency', () => {
    expect(frequencyLabel('fortnightly')).toBe('every two weeks');
  });
});
