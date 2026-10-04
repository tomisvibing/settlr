import { describe, it, expect } from 'vitest';
import { distribute, balances, settlements } from '../src/lib/ledger.js';

const sum = o => Object.values(o).reduce((s, v) => s + v, 0);

describe('distribute', () => {
  it('splits evenly when it divides exactly', () => {
    expect(distribute(900, { a: 1, b: 1, c: 1 })).toEqual({ a: 300, b: 300, c: 300 });
  });
  it('never loses or invents a penny', () => {
    for (const total of [1, 2, 99, 100, 101, 1000, 3333, 123457]) {
      const split = distribute(total, { a: 1, b: 1, c: 1 });
      expect(sum(split)).toBe(total);
      expect(Math.max(...Object.values(split)) - Math.min(...Object.values(split))).toBeLessThanOrEqual(1);
    }
  });
  it('respects share weights', () => {
    expect(distribute(1000, { a: 3, b: 1 })).toEqual({ a: 750, b: 250 });
    const s = distribute(1001, { a: 2, b: 1 });
    expect(sum(s)).toBe(1001);
    expect(s.a).toBeGreaterThan(s.b);
  });
  it('leaves out zero-weight people', () => {
    expect(distribute(500, { a: 1, b: 0 })).toEqual({ a: 500 });
  });
  it('returns null when nobody has a share', () => {
    expect(distribute(500, { a: 0, b: 0 })).toBeNull();
    expect(distribute(500, {})).toBeNull();
  });
});

describe('balances', () => {
  const g = (expenses, members = ['a', 'b', 'c']) => ({ members, expenses });

  it('credits the payer and debits everyone in the split', () => {
    const b = balances(g([{ paidBy: 'a', amount: 3000, splits: { a: 1000, b: 1000, c: 1000 } }]));
    expect(b).toEqual({ a: 2000, b: -1000, c: -1000 });
  });
  it('always nets to zero across the group', () => {
    const b = balances(g([
      { paidBy: 'a', amount: 3001, splits: distribute(3001, { a: 1, b: 1, c: 1 }) },
      { paidBy: 'b', amount: 1250, splits: { a: 1000, c: 250 } },
      { paidBy: 'c', amount: 500, splits: { a: 500 } }, // a payment from c to a
    ]));
    expect(sum(b)).toBe(0);
  });
  it('gives members with no expenses a zero balance', () => {
    expect(balances(g([]))).toEqual({ a: 0, b: 0, c: 0 });
  });
  it('ignores people who are no longer members', () => {
    const b = balances(g([{ paidBy: 'x', amount: 100, splits: { a: 100 } }], ['a']));
    expect(b).toEqual({ a: -100 });
  });
});

describe('settlements', () => {
  it('pays everyone back and clears every balance', () => {
    const b = { a: 5000, b: -2000, c: -1500, d: -1500 };
    const plan = settlements(b);
    const after = { ...b };
    for (const p of plan) { after[p.from] += p.amount; after[p.to] -= p.amount; }
    expect(Object.values(after).every(v => v === 0)).toBe(true);
    expect(plan.every(p => p.amount > 0)).toBe(true);
  });
  it('uses at most n - 1 transfers', () => {
    const b = { a: 700, b: 300, c: -400, d: -350, e: -250 };
    expect(settlements(b).length).toBeLessThanOrEqual(4);
  });
  it('matches the largest debtor to the largest creditor', () => {
    expect(settlements({ a: 1000, b: -1000 })).toEqual([{ from: 'b', to: 'a', amount: 1000 }]);
  });
  it('has nothing to do when everyone is square', () => {
    expect(settlements({ a: 0, b: 0 })).toEqual([]);
  });
});

describe('direct debts (simplify off)', () => {
  const e = (paidBy, amount, splits) => ({ type: 'expense', paidBy, amount, splits });
  const g = { members: ['a', 'b', 'c'], expenses: [e('a', 3000, { a: 1000, b: 1000, c: 1000 }), e('b', 3000, { a: 1000, b: 1000, c: 1000 })] };
  it('nets each pair directly, so c pays both a and b', async () => {
    const { directDebts } = await import('../src/lib/ledger.js');
    expect(directDebts(g).map(p => `${p.from}>${p.to}:${p.amount}`).sort()).toEqual(['c>a:1000', 'c>b:1000']);
  });
  it('simplified, the same group needs the same total but may route differently', async () => {
    const { paymentPlan } = await import('../src/lib/ledger.js');
    const total = p => p.reduce((s, x) => s + x.amount, 0);
    expect(total(paymentPlan({ ...g, simplify: true }))).toBe(2000);
  });
  it('a chain a<-b<-c stays a chain when off, collapses when on', async () => {
    const { paymentPlan } = await import('../src/lib/ledger.js');
    const chain = { members: ['a', 'b', 'c'], expenses: [e('a', 1000, { b: 1000 }), e('b', 1000, { c: 1000 })] };
    expect(paymentPlan({ ...chain, simplify: false })).toHaveLength(2);
    expect(paymentPlan({ ...chain, simplify: true })).toEqual([{ from: 'c', to: 'a', amount: 1000 }]);
  });
  it('treats a payment like an expense one paid for the other', async () => {
    const { directDebts } = await import('../src/lib/ledger.js');
    const pay = { members: ['a', 'b'], expenses: [e('a', 1000, { b: 1000 }), { type: 'payment', paidBy: 'b', amount: 400, splits: { a: 400 } }] };
    expect(directDebts(pay)).toEqual([{ from: 'b', to: 'a', amount: 600 }]);
  });
});
