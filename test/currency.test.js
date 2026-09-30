import { describe, it, expect } from 'vitest';
import { CURRENCIES, currencyOptions, currencyName, minorDigits, minorStep, plainAmount, money } from '../src/lib/format.js';
import { distribute } from '../src/lib/ledger.js';

describe('currencies', () => {
  it('offers a long list, the usual three first, with no repeats', () => {
    expect(CURRENCIES.slice(0, 3)).toEqual(['GBP', 'EUR', 'USD']);
    expect(CURRENCIES.length).toBeGreaterThan(40);
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
    for(const c of CURRENCIES) expect(() => money(100, c)).not.toThrow();
  });
  it('names them in the picker and keeps an unlisted current value', () => {
    expect(currencyName('JPY')).toMatch(/Yen/i);
    expect(currencyOptions('EUR')).toContain('<option value="EUR" selected>EUR · Euro</option>');
    expect(currencyOptions('XOF')).toMatch(/^<option value="XOF" selected>/);
  });
  it('knows which currencies have no pence', () => {
    expect(minorDigits('GBP')).toBe(2);
    expect(minorDigits('JPY')).toBe(0);
    expect(minorStep('GBP')).toBe(1);
    expect(minorStep('KRW')).toBe(100);
    expect(plainAmount(150000, 'JPY')).toBe('1500');
    expect(plainAmount(1250, 'GBP')).toBe('12.50');
  });
  it('splits yen into whole yen that still add up', () => {
    const out = distribute(100000, { a:1, b:1, c:1 }, 100);
    expect(Object.values(out).sort()).toEqual([33300, 33300, 33400]);
    expect(Object.values(out).every(v => v % 100 === 0)).toBe(true);
  });
  it('falls back to pennies when a whole-unit total isn’t whole', () => {
    const out = distribute(1001, { a:1, b:1 }, 100);
    expect(out.a + out.b).toBe(1001);
  });
  it('handles amounts far beyond the old 21 million ceiling', () => {
    const big = 5_000_000_000; // 50,000,000 dong in hundredths
    const out = distribute(big, { a:1, b:2 }, 100);
    expect(out.a + out.b).toBe(big);
  });
});
