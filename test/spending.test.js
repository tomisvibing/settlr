import { describe, it, expect } from 'vitest';
import { spendingAcross } from '../src/lib/spending.js';

const exp = (amount, category = null) => ({ type: 'expense', date: '2026-09-01', paidBy: 'a', amount, splits: { a: amount }, category });
const uk = { id: 1, name: 'Flat', currency: 'GBP', expenses: [exp(10000, 'bills'), exp(5000)] };
const fr = { id: 2, name: 'Paris', currency: 'EUR', expenses: [exp(20000, 'food')] };

describe('spending across groups', () => {
  it('converts each group into the home currency and ranks them', () => {
    const r = spendingAcross([uk, fr], { EUR: 0.85 }, 'GBP');
    expect(r.total).toBe(32000);
    expect(r.byGroup.map(x => [x.name, x.amount])).toEqual([['Paris', 17000], ['Flat', 15000]].sort((a, b) => b[1] - a[1]));
  });
  it('adds up categories across groups, uncategorised included', () => {
    const r = spendingAcross([uk, fr], { EUR: 0.85 }, 'GBP');
    expect(r.byCategory).toEqual([{ category: 'food', amount: 17000 }, { category: 'bills', amount: 10000 }, { category: null, amount: 5000 }]);
  });
  it('names a currency with no rate and leaves it out', () => {
    const r = spendingAcross([uk, fr], {}, 'GBP');
    expect(r.total).toBe(15000);
    expect(r.missing).toEqual(['EUR']);
  });
  it('skips groups with nothing spent', () => {
    expect(spendingAcross([{ id: 3, name: 'New', currency: 'GBP', expenses: [] }], {}, 'GBP').byGroup).toEqual([]);
  });
});
