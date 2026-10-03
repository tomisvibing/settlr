import { describe, it, expect } from 'vitest';
import { missingParts, nextTarget, goLabel, isIdle } from '../src/lib/compose.js';

const full = { hasGroup: true, later: false, pence: 4250, what: 'Dinner', whoCount: 3 };

describe('missing parts', () => {
  it('lists group, amount, what and who in the order they’re filled in', () => {
    expect(missingParts({ hasGroup: false, later: false, pence: 0, what: '', whoCount: 0 })).toEqual(['group', 'amount', 'what']);
    expect(missingParts({ ...full, pence: 0, what: ' ', whoCount: 0 })).toEqual(['amount', 'what', 'who']);
    expect(missingParts(full)).toEqual([]);
  });
  it('lets "decide later" skip the group and the people', () => {
    expect(missingParts({ ...full, hasGroup: false, later: true, whoCount: 0 })).toEqual([]);
  });
});

describe('the next part to go to', () => {
  it('never points at the part you’re already on', () => {
    expect(nextTarget(['amount', 'what'], 'amount')).toBe('what');
    expect(nextTarget(['amount', 'what'], 'what')).toBe('amount');
    expect(nextTarget(['group', 'amount'], 'group')).toBe('amount');
  });
  it('moves forward first, then wraps round', () => {
    expect(nextTarget(['amount', 'who'], 'what')).toBe('who');
    expect(nextTarget(['amount', 'what'], null)).toBe('amount');
  });
  it('is nothing when the open part is the only one left', () => {
    expect(nextTarget(['amount'], 'amount')).toBeNull();
  });
});

describe('new-expense button', () => {
  const base = { mode: 'equal', hasGroup: true, amountText: '£42.50', groupName: 'Paris' };
  it('says Next with the following part, not the one you’re on', () => {
    expect(goLabel({ ...base, missing: ['amount', 'what'], open: 'amount' })).toBe('Next: what for');
    expect(goLabel({ ...base, missing: ['amount', 'what'], open: null })).toBe('Next: amount');
  });
  it('reads as an inactive Add when only the open part is empty', () => {
    const s = { ...base, missing: ['amount'], open: 'amount' };
    expect(goLabel(s)).toBe('Add to Paris');
    expect(isIdle(s)).toBe(true);
    expect(isIdle({ ...s, open: null })).toBe(false);
  });
  it('names the money and the place once it will actually add', () => {
    expect(goLabel({ ...base, missing: [], open: 'amount' })).toBe('Add £42.50 to Paris');
    expect(isIdle({ ...base, missing: [], open: 'amount' })).toBe(false);
  });
  it('saves for later with no group', () => {
    expect(goLabel({ ...base, hasGroup: false, missing: [], open: 'amount' })).toBe('Save for later');
  });
  it('hands over to the amounts screen for shares and exact splits', () => {
    expect(goLabel({ ...base, mode: 'shares', missing: ['amount'], open: 'amount' })).toBe('Set the amounts');
    expect(isIdle({ ...base, mode: 'exact', missing: ['amount'], open: 'amount' })).toBe(false);
  });
});
