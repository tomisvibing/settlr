import { describe, it, expect } from 'vitest';
import { byCategory, byMonth, paidMost, totalSpent } from '../src/lib/insights.js';
import { categoryLabel, isCategory } from '../src/lib/categories.js';

const g = { members: ['a', 'b'], expenses: [
  { type: 'expense', amount: 3000, paidBy: 'a', date: '2026-08-30', category: 'food' },
  { type: 'expense', amount: 1200, paidBy: 'b', date: '2026-10-02', category: 'food' },
  { type: 'expense', amount: 5000, paidBy: 'a', date: '2026-10-03', category: 'stay' },
  { type: 'expense', amount: 700, paidBy: 'b', date: '2026-10-04' },
  { type: 'payment', amount: 9999, paidBy: 'b', date: '2026-10-05' },
] };

describe('insights', () => {
  it('totals spending without payments between people', () => {
    expect(totalSpent(g)).toBe(3000 + 1200 + 5000 + 700);
  });
  it('groups by category, biggest first, with the uncategorised together', () => {
    expect(byCategory(g)).toEqual([
      { key: 'stay', total: 5000, count: 1 },
      { key: 'food', total: 4200, count: 2 },
      { key: null, total: 700, count: 1 },
    ]);
  });
  it('groups by month and fills the quiet ones in with zero', () => {
    expect(byMonth(g)).toEqual([
      { month: '2026-08', total: 3000, count: 1 },
      { month: '2026-09', total: 0, count: 0 },
      { month: '2026-10', total: 6900, count: 3 },
    ]);
  });
  it('steps across a year end', () => {
    const y = { expenses: [{ type: 'expense', amount: 1, paidBy: 'a', date: '2025-12-31' }, { type: 'expense', amount: 1, paidBy: 'a', date: '2026-01-01' }] };
    expect(byMonth(y).map(m => m.month)).toEqual(['2025-12', '2026-01']);
  });
  it('ranks who paid most, counting payments as nothing', () => {
    expect(paidMost(g)).toEqual([
      { pid: 'a', total: 8000, count: 2 },
      { pid: 'b', total: 1900, count: 2 },
    ]);
  });
  it('copes with an empty group', () => {
    const e = { members: [], expenses: [] };
    expect([byCategory(e), byMonth(e), paidMost(e), totalSpent(e)]).toEqual([[], [], [], 0]);
  });
  it('names categories', () => {
    expect(categoryLabel('food')).toBe('Food & drink');
    expect(categoryLabel(null)).toBe('Uncategorised');
    expect(isCategory('stay')).toBe(true);
    expect(isCategory('drop table')).toBe(false);
  });
});
