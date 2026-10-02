import { describe, it, expect } from 'vitest';
import { overallTotal } from '../src/lib/fx.js';

describe('overallTotal', () => {
  it('adds your balances in one currency, signs and all', () => {
    const t = overallTotal([['GBP', 1000], ['EUR', -2000], ['USD', 500]], { EUR: 0.85, USD: 0.8 }, 'GBP');
    expect(t).toEqual({ amount: 1000 - 1700 + 400, missing: [] });
  });
  it('counts the home currency as is, with no rate needed', () => {
    expect(overallTotal([['GBP', -250]], {}, 'GBP')).toEqual({ amount: -250, missing: [] });
  });
  it('leaves out a currency with no rate and says so', () => {
    expect(overallTotal([['GBP', 1000], ['XOF', 5000]], {}, 'GBP')).toEqual({ amount: 1000, missing: ['XOF'] });
    expect(overallTotal([['GBP', 1000], ['EUR', 5000]], { EUR: null }, 'GBP').missing).toEqual(['EUR']);
  });
  it('rounds to whole units for a currency without pence', () => {
    expect(overallTotal([['GBP', 1000]], { GBP: 190.123 }, 'JPY').amount % 100).toBe(0);
  });
});
