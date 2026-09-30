import { describe, it, expect } from 'vitest';
import { convert, parseRate, formatRate, canFetch } from '../src/lib/fx.js';

describe('currency conversion', () => {
  it('converts into the group currency at the rate', () => {
    expect(convert(4500, 1.0622, 'EUR')).toBe(4780); // CHF 45.00 → €47.80
    expect(convert(100000, 0.0062, 'EUR')).toBe(620); // ¥1,000 → €6.20
  });
  it('rounds to whole units for groups without pence', () => {
    expect(convert(4780, 161.4, 'JPY')).toBe(771500); // €47.80 → ¥7,715
    expect(convert(4780, 161.4, 'JPY') % 100).toBe(0);
  });
  it('never turns a real amount into zero, and refuses nonsense', () => {
    expect(convert(1, 0.0001, 'EUR')).toBe(1);
    expect(convert(0, 1.2, 'EUR')).toBe(0);
    expect(convert(500, 0, 'EUR')).toBe(0);
    expect(convert(500, NaN, 'EUR')).toBe(0);
  });
  it('reads typed rates, with either decimal mark', () => {
    expect(parseRate('1.0622')).toBe(1.0622);
    expect(parseRate('1,0622')).toBe(1.0622);
    expect(parseRate('.5')).toBe(0.5);
    for(const bad of ['', '0', '-1', 'abc', '1.2.3']) expect(parseRate(bad)).toBeNaN();
  });
  it('shows rates without float noise', () => {
    expect(formatRate(1.0622000000001)).toBe('1.0622');
    expect(formatRate(0.00623456789)).toBe('0.00623457');
    expect(formatRate(161.4)).toBe('161.4');
  });
  it('knows which pairs the free rates cover', () => {
    expect(canFetch('CHF', 'EUR')).toBe(true);
    expect(canFetch('VND', 'EUR')).toBe(false);
  });
});
