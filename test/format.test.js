import { describe, it, expect } from 'vitest';
import { toPence, money, ago, slug, initial, esc } from '../src/lib/format.js';
import { csvCell } from '../src/lib/csv.js';

describe('toPence', () => {
  it('reads plain and formatted amounts', () => {
    expect(toPence('12.50')).toBe(1250);
    expect(toPence('£12.50')).toBe(1250);
    expect(toPence('12')).toBe(1200);
    expect(toPence(' 0.1 ')).toBe(10);
  });
  it('rounds floating-point noise to the nearest penny', () => {
    expect(toPence('19.99')).toBe(1999);
    expect(toPence('0.29')).toBe(29);
  });
  it('treats blank as zero and junk as NaN', () => {
    expect(toPence('')).toBe(0);
    expect(toPence(null)).toBe(0);
    expect(toPence('1.2.3')).toBeNaN();
  });
});

describe('money', () => {
  it('formats pence in the currency', () => {
    expect(money(1250, 'GBP')).toBe('£12.50');
    expect(money(100000, 'EUR')).toBe('€1,000.00');
  });
  it('falls back for an unknown currency code', () => {
    expect(money(1250, 'NOPE!')).toBe('12.50 NOPE!');
  });
});

describe('ago', () => {
  const now = new Date(2026, 8, 27, 15, 0).getTime();
  it('describes recent days in words', () => {
    expect(ago(new Date(2026, 8, 27, 9, 0).getTime(), now)).toBe('today');
    expect(ago(new Date(2026, 8, 26, 23, 0).getTime(), now)).toBe('yesterday');
    expect(ago(new Date(2026, 8, 24, 12, 0).getTime(), now)).toBe('3 days ago');
  });
  it('is blank without a time', () => {
    expect(ago(0, now)).toBe('');
  });
});

describe('small helpers', () => {
  it('slug makes a safe filename', () => {
    expect(slug('Lisbon weekend!')).toBe('lisbon-weekend');
    expect(slug('!!!')).toBe('settlr');
  });
  it('initial handles emoji and blanks', () => {
    expect(initial('flat 4B')).toBe('F');
    expect(initial('🏖️ Trip')).toBe('🏖');
    expect(initial('')).toBe('?');
  });
  it('esc neutralises HTML', () => {
    expect(esc('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
  });
});

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });
  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('leaves negative numbers alone', () => {
    expect(csvCell('-12.50')).toBe('-12.50');
  });
});
