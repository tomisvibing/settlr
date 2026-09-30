import { describe, it, expect } from 'vitest';
import { friendlyError } from '../src/lib/errors.js';

describe('friendly error messages', () => {
  it('turns network failures into a connection hint', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe('Couldn’t save: settlr can’t be reached. Check your connection and try again.');
    expect(friendlyError({ message: 'Load failed' }, 'delete')).toMatch(/^Couldn’t delete: /);
  });
  it('passes through the sentences our database rules raise, with a full stop', () => {
    expect(friendlyError({ code: 'P0001', message: 'Settle up before leaving: your balance in this group isn’t zero' }))
      .toBe('Settle up before leaving: your balance in this group isn’t zero.');
    expect(friendlyError({ code: 'P0001', message: 'A group needs at least one admin.' })).toBe('A group needs at least one admin.');
  });
  it('rewrites the terse ones', () => {
    expect(friendlyError({ code: 'P0001', message: 'Invalid invite code' }, 'join')).toBe('That invite code didn’t work. Check it and try again.');
    expect(friendlyError({ code: 'P0001', message: 'Not signed in' })).toMatch(/signed out/);
  });
  it('never shows row-level security or other internals', () => {
    const rls = friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "expenses"' });
    expect(rls).not.toMatch(/row-level|expenses/);
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint', details: 'Key (id)=(1)' }))
      .toBe('Couldn’t save. Check your connection and try again.');
    expect(friendlyError(undefined, 'load')).toBe('Couldn’t load. Check your connection and try again.');
  });
});
