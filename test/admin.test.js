import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/store.js';
import { canAdmin, rosterFor } from '../src/selectors.js';

const g = (admins, members = ['me', 'bob', 'sam']) => ({ id: 'g', members, left: [], admins, expenses: [] });
beforeEach(() => {
  state.people = [{ id:'me', name:'Me', userId:'u1' }, { id:'bob', name:'Bob', userId:'u2' }, { id:'sam', name:'Sam', userId:null }];
  state.myIds = new Set(['me']);
});

describe('who runs a group', () => {
  it('admins do, other members don’t', () => {
    expect(canAdmin(g(['me']))).toBe(true);
    expect(canAdmin(g(['bob']))).toBe(false);
  });
  it('with no admin who has an account, every member does', () => {
    expect(canAdmin(g([]))).toBe(true);
    expect(canAdmin(g(['sam']))).toBe(true);
  });
  it('not someone who isn’t in the group', () => {
    expect(canAdmin(g([], ['bob', 'sam']))).toBe(false);
  });
});

describe('editing an entry', () => {
  it('keeps people who have left but are on the entry', () => {
    const e = { paidBy: 'zoe', splits: { me: 100, zoe: 100 } };
    expect(rosterFor(g(['me']), e)).toEqual(['me', 'bob', 'sam', 'zoe']);
    expect(rosterFor(g(['me']), null)).toEqual(['me', 'bob', 'sam']);
  });
});
