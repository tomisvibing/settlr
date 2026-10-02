import { describe, it, expect } from 'vitest';
import { balances, settlements, pairwiseDebts, settlePlan } from '../src/lib/ledger.js';

const g = {
  members: ['a', 'b', 'c'],
  expenses: [
    { paidBy: 'a', amount: 3000, splits: { a: 1000, b: 1000, c: 1000 } },
    { paidBy: 'b', amount: 1000, splits: { a: 400, b: 600 } },
  ],
};
/* Net each plan into per-person balances: both must clear everyone to zero */
const settled = (plan, base) => { const b = { ...base }; plan.forEach(p => { b[p.from] += p.amount; b[p.to] -= p.amount; }); return b; };

describe('pairwiseDebts', () => {
  it('nets each pair against itself', () => {
    expect(pairwiseDebts(g)).toEqual(expect.arrayContaining([
      { from: 'b', to: 'a', amount: 600 },
      { from: 'c', to: 'a', amount: 1000 },
    ]));
    expect(pairwiseDebts(g)).toHaveLength(2);
  });
  it('clears everyone to square, like the simplified plan', () => {
    const b = balances(g);
    expect(Object.values(settled(pairwiseDebts(g), b)).every(v => v === 0)).toBe(true);
    expect(Object.values(settled(settlements(b), b)).every(v => v === 0)).toBe(true);
  });
  it('can need more payments than the simplified plan', () => {
    const chain = { members: ['a', 'b', 'c'], expenses: [
      { paidBy: 'a', amount: 1000, splits: { b: 1000 } },
      { paidBy: 'b', amount: 1000, splits: { c: 1000 } },
    ] };
    expect(pairwiseDebts(chain)).toHaveLength(2);
    expect(settlements(balances(chain))).toHaveLength(1);
  });
  it('ignores people who have left, as balances() does', () => {
    const left = { members: ['a', 'b'], expenses: [{ paidBy: 'a', amount: 3000, splits: { a: 1000, b: 1000, x: 1000 } }] };
    expect(pairwiseDebts(left)).toEqual([{ from: 'b', to: 'a', amount: 1000 }]);
  });
  it('records a payment as settling the debt', () => {
    const paid = { members: ['a', 'b'], expenses: [
      { paidBy: 'a', amount: 2000, splits: { a: 1000, b: 1000 } },
      { type: 'payment', paidBy: 'b', amount: 1000, splits: { a: 1000 } },
    ] };
    expect(pairwiseDebts(paid)).toEqual([]);
  });
  it('settlePlan picks by the flag', () => {
    expect(settlePlan(g, false)).toEqual(pairwiseDebts(g));
    expect(settlePlan(g)).toEqual(settlements(balances(g)));
  });
});
