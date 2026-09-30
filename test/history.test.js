import { describe as group, it, expect } from 'vitest';
import { describe, changes } from '../src/lib/history.js';

const names = { pA: 'Alice', pB: 'Bob' };
const ctx = {
  name: id => names[id] || 'Someone',
  money: (v, cur = 'EUR') => `${cur} ${(v / 100).toFixed(2)}`,
  isMe: uid => uid === 'u-me',
  exists: id => id === 'still-here',
};
const entry = (over = {}) => ({ description: 'Dinner', amount_cents: 4000, paid_by: 'pA', expense_date: '2026-09-28', split_mode: 'equal', split_input: { pA: 1, pB: 1 }, orig_currency: null, orig_amount_cents: null, ...over });
const ev = (action, data, over = {}) => ({ action, entity: 'expense', entity_id: 'e1', actor_user: 'u-bob', actor_name: 'Bob', data, ...over });

group('history sentences', () => {
  it('names who did it, or You', () => {
    expect(describe(ev('added', { after: entry() }), ctx).text).toBe('Bob added “Dinner” · EUR 40.00');
    expect(describe(ev('added', { after: entry() }, { actor_user: 'u-me' }), ctx).text).toBe('You added “Dinner” · EUR 40.00');
  });
  it('spells out edits', () => {
    const t = describe(ev('edited', { before: entry(), after: entry({ amount_cents: 4500, description: 'Dinner at Taberna', paid_by: 'pB' }) }), ctx).text;
    expect(t).toBe('Bob edited “Dinner”: renamed it “Dinner at Taberna”, EUR 40.00 → EUR 45.00, paid by Bob');
    expect(changes(entry(), entry({ split_input: { pA: 1 } }), ctx)).toEqual(['changed the split']);
  });
  it('shows both currencies for foreign spending', () => {
    const t = describe(ev('added', { after: entry({ amount_cents: 4780, orig_currency: 'CHF', orig_amount_cents: 4500 }) }), ctx).text;
    expect(t).toBe('Bob added “Dinner” · CHF 45.00 (EUR 47.80)');
  });
  it('offers Restore only for entries that are still gone', () => {
    expect(describe(ev('deleted', { before: entry() }), ctx)).toMatchObject({ text: 'Bob deleted “Dinner” · EUR 40.00', restore: 'e1' });
    expect(describe(ev('deleted', { before: entry() }, { entity_id: 'still-here' }), ctx).restore).toBeNull();
  });
  it('describes payments and group changes', () => {
    expect(describe(ev('added', { after: entry({ paid_by: 'pB', amount_cents: 1500 }) }, { entity: 'payment' }), ctx).text).toBe('Bob recorded a payment from Bob · EUR 15.00');
    expect(describe(ev('renamed', { from: 'Paris', to: 'Paris trip' }, { entity: 'group' }), ctx).text).toBe('Bob renamed the group “Paris trip”');
    expect(describe(ev('left', { name: 'Sam' }, { entity: 'member' }), ctx).text).toBe('Sam left the group');
    expect(describe(ev('restored', {}, { entity: 'group' }), ctx).text).toBe('Bob restored the group from the archive');
  });
});
