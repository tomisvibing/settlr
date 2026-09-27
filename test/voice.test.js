import { describe, it, expect } from 'vitest';
import { parseVoiceExpense } from '../src/lib/voice.js';

const members = [{ id: 'me', name: 'Alice' }, { id: 's', name: 'Sam' }, { id: 'b', name: 'Bob' }];
// Sunday 27 September 2026, mid-afternoon
const now = new Date(2026, 8, 27, 15, 0);
const parse = text => parseVoiceExpense(text, members, now);

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
  });
  it('spots who paid', () => {
    expect(parse('Sam paid £40 for the taxi').paidBy).toBe('s');
  });
  it('picks up an equal split between named people', () => {
    const r = parse('£30 lunch between Sam and Bob');
    expect(r.mode).toBe('equal');
    expect(r.subset).toEqual(['s', 'b']);
  });
  it('keeps the rest as a tidy description', () => {
    expect(parse("dinner at Nando's yesterday £45 split equally").desc).toBe("Dinner at Nando's");
    expect(parse('£12 cinema tickets').desc).toBe('Cinema tickets');
  });
});
