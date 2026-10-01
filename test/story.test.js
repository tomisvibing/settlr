import { describe, it, expect } from 'vitest';
import { storyParts, storyText, whoOwesWhom } from '../src/lib/story.js';
import { money } from '../src/lib/format.js';

const names = { me: 'You', a: 'Alex', p: 'Priya', s: 'Sam', j: 'Jess', m: 'Mo' };
const isMe = id => id === 'me';
const exp = (paidBy, amount, splits) => ({ type: 'expense', paidBy, amount, splits });
const group = (name, currency, members, expenses, archivedAt = null) => ({ name, currency, members, expenses, archivedAt });
const tell = groups => storyText(storyParts(groups, isMe, id => names[id], money));

const lisbon = group('Lisbon weekend', 'GBP', ['me', 'a', 'p'], [exp('me', 60000, { me: 20000, a: 20000, p: 20000 })]);
const chalet = group('the ski chalet', 'EUR', ['me', 's'], [exp('s', 65800, { me: 32900, s: 32900 })]);
const tokyo = group('Tokyo', 'JPY', ['me', 's'], [exp('me', 4000, { me: 2000, s: 2000 }), exp('s', 4000, { me: 2000, s: 2000 })]);

describe('the overview sentence', () => {
  it('says who owes you, who you owe and what is square', () => {
    expect(tell([lisbon, chalet, tokyo])).toBe('Alex owes you £200.00 and Priya £200.00, both from Lisbon weekend. You owe Sam €329.00 for the ski chalet. Tokyo is square.');
  });
  it('keeps currencies apart and names the group only when there is one', () => {
    const flat = group('Flat 4B', 'GBP', ['me', 'a'], [exp('me', 2000, { me: 1000, a: 1000 })]);
    const euro = group('Paris', 'EUR', ['me', 'a'], [exp('me', 4000, { me: 2000, a: 2000 })]);
    expect(tell([flat, euro])).toBe('Alex owes you £10.00 and €20.00.');
  });
  it('says "plus" between one person’s currencies when two people share the sentence', () => {
    const yen = group('Osaka', 'JPY', ['me', 's'], [exp('s', 4000, { me: 2000, s: 2000 })]);
    expect(tell([chalet, yen, group('Kyoto', 'JPY', ['me', 'a'], [exp('a', 4000, { me: 2000, a: 2000 })])]))
      .toBe('You owe Sam €329.00 plus JP¥20 and Alex JP¥20.');
  });
  it('folds a long list into a count', () => {
    const big = group('Stag do', 'GBP', ['me', 'a', 'p', 'j', 'm'], [exp('me', 50000, { me: 10000, a: 10000, p: 10000, j: 10000, m: 10000 })]);
    expect(tell([big])).toMatch(/^Alex owes you £100\.00, Priya £100\.00, and 2 more people owe you too, all from Stag do\.$/);
  });
  it('is calm when everything is settled or nothing has happened', () => {
    expect(tell([tokyo])).toBe('Everything’s square. Nobody owes anybody.');
    expect(tell([group('New', 'GBP', ['me', 'a'], [])])).toBe('Nothing to settle yet. Add an expense and it’ll show up here.');
  });
  it('still counts archived groups that owe, but never calls them square', () => {
    const old = group('Old flat', 'GBP', ['me', 'a'], [exp('a', 1000, { me: 500, a: 500 })], 1);
    const settledOld = group('Older flat', 'GBP', ['me', 'a'], [exp('a', 1000, { me: 500, a: 500 }), exp('me', 1000, { me: 500, a: 500 })], 1);
    const w = whoOwesWhom([old, settledOld], isMe);
    expect(w.iOwe.map(x => x.pid)).toEqual(['a']);
    expect(w.square).toEqual([]);
  });
  it('marks people and amounts so the view can link and colour them', () => {
    const parts = storyParts([chalet], isMe, id => names[id], money);
    expect(parts.find(p => p.person)).toEqual({ person: 's', name: 'Sam' });
    expect(parts.find(p => p.amount)).toEqual({ amount: '€329.00', tone: 'down' });
  });
});
