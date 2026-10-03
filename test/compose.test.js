import { describe, it, expect } from 'vitest';
import { missingPart, goLabel } from '../src/lib/compose.js';

const full = { hasGroup: true, later: false, pence: 4250, what: 'Dinner', whoCount: 3 };

describe('new-expense button', () => {
  it('asks for the group first, then amount, what and who', () => {
    expect(missingPart({ ...full, hasGroup: false })).toBe('group');
    expect(missingPart({ ...full, pence: 0 })).toBe('amount');
    expect(missingPart({ ...full, what: '  ' })).toBe('what');
    expect(missingPart({ ...full, whoCount: 0 })).toBe('who');
    expect(missingPart(full)).toBeNull();
  });
  it('lets "decide later" skip the group and the people', () => {
    expect(missingPart({ ...full, hasGroup: false, later: true, whoCount: 0 })).toBeNull();
  });
  it('says Next while something is missing', () => {
    expect(goLabel({ missing: 'amount', mode: 'equal', hasGroup: true })).toBe('Next: amount');
    expect(goLabel({ missing: 'group', mode: 'equal', hasGroup: false })).toBe('Next: pick a group');
    expect(goLabel({ missing: 'what', mode: 'equal', hasGroup: true })).toBe('Next: what for');
  });
  it('names the money and the place once it will actually add', () => {
    expect(goLabel({ missing: null, mode: 'equal', hasGroup: true, amountText: '£42.50', groupName: 'Paris' })).toBe('Add £42.50 to Paris');
    expect(goLabel({ missing: null, mode: 'equal', hasGroup: false })).toBe('Save for later');
  });
  it('hands over to the amounts screen for shares and exact splits', () => {
    expect(goLabel({ missing: 'amount', mode: 'shares', hasGroup: true })).toBe('Set the amounts');
    expect(goLabel({ missing: null, mode: 'exact', hasGroup: true, amountText: '£1', groupName: 'x' })).toBe('Set the amounts');
  });
});
