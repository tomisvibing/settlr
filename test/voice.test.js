import { describe, it, expect } from 'vitest';
import { parseVoiceExpense } from '../src/lib/voice.js';

const members = [{ id: 'me', name: 'Alice' }, { id: 's', name: 'Sam' }, { id: 'b', name: 'Bob' }];
// Sunday 27 September 2026, mid-afternoon
const now = new Date(2026, 8, 27, 15, 0);
const parse = text => parseVoiceExpense(text, members, now, 'me');

describe('parseVoiceExpense', () => {
  it('reads the amount from a currency symbol or word', () => {
    expect(parse('£24.50 for pizza').amount).toBe(2450);
    expect(parse('pizza 30 quid').amount).toBe(3000);
    expect(parse('pizza 12,5 euros').amount).toBe(1250);
  });
  it('reads relative dates', () => {
    expect(parse('dinner yesterday £20').date).toBe('2026-09-26');
    expect(parse('dinner tonight £20').date).toBe('2026-09-27');
    expect(parse('dinner on friday £20').date).toBe('2026-09-25');
    expect(parse('dinner last sunday £20').date).toBe('2026-09-20');
    expect(parse('drinks last night £20').date).toBe('2026-09-26');
  });
  it('spots who paid', () => {
    expect(parse('Sam paid £40 for the taxi').paidBy).toBe('s');
    expect(parse('taxi £40 paid by Bob').paidBy).toBe('b');
    expect(parse("Dinner at Nando's, I paid £37").paidBy).toBe('me');
    expect(parse('pizza, it cost me 20 quid').paidBy).toBe('me');
    expect(parse('pizza £20').paidBy).toBeUndefined();
  });
  it('picks up who it was split between', () => {
    expect(parse('£30 lunch between Sam and Bob')).toMatchObject({ mode: 'equal', subset: ['s', 'b'] });
    expect(parse('lunch £30, split with Sam')).toMatchObject({ mode: 'equal', subset: ['me', 's'] });
    expect(parse('lunch £30, split between me and Bob')).toMatchObject({ mode: 'equal', subset: ['me', 'b'] });
    expect(parse('lunch £30 split equally').mode).toBe('equal');
    expect(parse('lunch £30 split equally').subset).toBeUndefined();
  });
  it('keeps only the thing itself as the description', () => {
    expect(parse("dinner at Nando's yesterday £45 split equally").desc).toBe("Dinner at Nando's");
    expect(parse('£12 cinema tickets').desc).toBe('Cinema tickets');
    expect(parse('Sam paid £40 for the taxi').desc).toBe('Taxi');
    expect(parse("Dinner at Nando's, I paid £37").desc).toBe("Dinner at Nando's");
  });
  it('drops the story around it', () => {
    const r = parse("Yesterday we went for dinner at Nando's, and it cost me £37, and it's split between Sam and Bob");
    expect(r).toMatchObject({ desc: "Dinner at Nando's", amount: 3700, paidBy: 'me', date: '2026-09-26', mode: 'equal', subset: ['s', 'b'] });
    expect(parse('so we got a taxi home and it was 18 pounds').desc).toBe('Taxi home');
    expect(parse('I bought groceries for 42.50').desc).toBe('Groceries');
    expect(parse('um we had drinks with Sam and Bob £60').desc).toBe('Drinks');
    expect(parse('Petrol £55 I paid split with Bob')).toMatchObject({ desc: 'Petrol', paidBy: 'me', subset: ['me', 'b'] });
  });
  it('falls back to what was said if nothing else is left', () => {
    expect(parse('£20').desc).toBe('£20');
  });
});
