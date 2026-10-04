import { describe, it, expect } from 'vitest';
import { insights } from '../src/lib/insights.js';

const e = (date, paidBy, amount, splits, type = 'expense', category = null) => ({ type, date, paidBy, amount, splits, category });
const g = { expenses: [
  e('2026-08-30', 'a', 6000, { a: 3000, b: 3000 }, 'expense', 'food'),
  e('2026-09-02', 'b', 9000, { a: 3000, b: 3000, c: 3000 }),
  e('2026-09-20', 'a', 3000, { a: 1500, b: 1500 }, 'expense', 'food'),
  e('2026-09-21', 'b', 4000, { a: 4000 }, 'payment'),
] };

describe('group insights', () => {
  const i = insights(g);
  it('totals spending and ignores payments between people', () => {
    expect(i.total).toBe(18000);
    expect(i.count).toBe(3);
  });
  it('groups spending by month, oldest first', () => {
    expect(i.byMonth).toEqual([{ month: '2026-08', amount: 6000 }, { month: '2026-09', amount: 12000 }]);
  });
  it('ranks who paid the most and whose share is largest', () => {
    expect(i.paidBy).toEqual([{ pid: 'a', amount: 9000 }, { pid: 'b', amount: 9000 }]);
    expect(i.shareOf.map(x => x.pid)).toEqual(['a', 'b', 'c']);
    expect(i.shareOf[0].amount).toBe(7500);
  });
  it('totals by category, largest first, with uncategorised kept apart', () => {
    expect(i.byCategory).toHaveLength(2);
    expect(i.byCategory.find(x => x.category === 'food').amount).toBe(9000);
    expect(i.byCategory.find(x => x.category === null).amount).toBe(9000);
  });
  it('finds the biggest expense', () => {
    expect(i.biggest.amount).toBe(9000);
  });
  it('copes with an empty group', () => {
    expect(insights({ expenses: [] })).toMatchObject({ total: 0, count: 0, biggest: null, byMonth: [], paidBy: [] });
  });
});
