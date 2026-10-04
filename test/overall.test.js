import { describe, it, expect } from 'vitest';
import { overall, needsOverall } from '../src/lib/overall.js';

describe('overall total in your own currency', () => {
  it('adds balances converted at their rates', () => {
    const r = overall([['GBP', 10000], ['EUR', -2000]], { EUR: 0.85 }, 'GBP');
    expect(r).toEqual({ total: 8300, missing: [] });
  });
  it('leaves out currencies with no rate and says which', () => {
    const r = overall([['GBP', 5000], ['RSD', 90000]], {}, 'GBP');
    expect(r).toEqual({ total: 5000, missing: ['RSD'] });
  });
  it('rounds to whole units for a currency without pence', () => {
    expect(overall([['GBP', 1001]], { GBP: 161.4 }, 'JPY').total % 100).toBe(0);
  });
  it('only matters across more than one currency', () => {
    expect(needsOverall([['GBP', 1]])).toBe(false);
    expect(needsOverall([['GBP', 1], ['EUR', 2]])).toBe(true);
    expect(needsOverall([])).toBe(false);
  });
});
