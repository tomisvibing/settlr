import { describe, it, expect } from 'vitest';
import { payLinks, cleanHandle } from '../src/lib/paylinks.js';

describe('payment links', () => {
  const all = { monzo: 'tomh', paypal: 'tomhughes', revolut: 'tomh99' };
  it('fills in the amount and a note for Monzo, in pounds', () => {
    expect(payLinks(all, 41152, 'GBP', 'Lisbon weekend')[0]).toEqual({ key: 'monzo', name: 'Monzo', filled: true, url: 'https://monzo.me/tomh/411.52?d=Lisbon%20weekend' });
  });
  it('leaves Monzo out for other currencies; PayPal carries the currency', () => {
    const links = payLinks(all, 32900, 'EUR');
    expect(links.map(l => l.key)).toEqual(['paypal', 'revolut']);
    expect(links[0].url).toBe('https://paypal.me/tomhughes/329.00EUR');
  });
  it('uses whole units for currencies without pence', () => {
    expect(payLinks({ paypal: 'x' }, 240000, 'JPY')[0].url).toBe('https://paypal.me/x/2400JPY');
  });
  it('opens Revolut without an amount, and says so', () => {
    expect(payLinks({ revolut: 'tomh99' }, 100, 'GBP')).toEqual([{ key: 'revolut', name: 'Revolut', filled: false, url: 'https://revolut.me/tomh99' }]);
  });
  it('has nothing without handles', () => {
    expect(payLinks(null, 100, 'GBP')).toEqual([]);
    expect(payLinks({}, 100, 'GBP')).toEqual([]);
  });
  it('accepts a username, an @handle or a pasted link', () => {
    expect(cleanHandle('tomh', 'monzo.me')).toBe('tomh');
    expect(cleanHandle('@tomh', 'revolut.me')).toBe('tomh');
    expect(cleanHandle('https://monzo.me/tomh/10?d=x', 'monzo.me')).toBe('tomh');
    expect(cleanHandle('www.paypal.me/Tom.Hughes', 'paypal.me')).toBe('Tom.Hughes');
    expect(cleanHandle('', 'monzo.me')).toBe('');
    expect(cleanHandle('not a name', 'monzo.me')).toBe(null);
  });
});
