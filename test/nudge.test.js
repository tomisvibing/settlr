import { describe, it, expect } from 'vitest';
import { dueNudges, nudgeKey, nudgeText, nudgeMessage, frequencyMs, WEEK } from '../src/lib/nudge.js';

const isMe = id => id === 'me';
const now = Date.parse('2026-10-01T12:00:00Z');
const exp = (paidBy, amount, splits) => ({ type: 'expense', paidBy, amount, splits });
const g = (id, quietFor, expenses, extra = {}) => ({ id, name: id, currency: 'GBP', members: ['me', 'a', 'b'], expenses, quiet: quietFor, archivedAt: null, ...extra });
const lastActivity = x => now - x.quiet;
const lisbon = g('lisbon', 8 * 864e5, [exp('me', 30000, { me: 10000, a: 10000, b: 10000 })]);

describe('weekly nudges', () => {
  it('lines up everyone who owes you once a group has been quiet for a week', () => {
    expect(dueNudges([lisbon], isMe, { now, lastActivity }).map(x => [x.pid, x.amount])).toEqual([['a', 10000], ['b', 10000]]);
  });
  it('waits while the group is still active, and skips archived groups', () => {
    expect(dueNudges([{ ...lisbon, quiet: 2 * 864e5 }], isMe, { now, lastActivity })).toEqual([]);
    expect(dueNudges([{ ...lisbon, archivedAt: 1 }], isMe, { now, lastActivity })).toEqual([]);
  });
  it('leaves out anyone nudged in the last week', () => {
    const nudged = { [nudgeKey('lisbon', 'a')]: now - 3 * 864e5, [nudgeKey('lisbon', 'b')]: now - WEEK - 1 };
    expect(dueNudges([lisbon], isMe, { now, nudged, lastActivity }).map(x => x.pid)).toEqual(['b']);
  });
  it('never asks you to nudge someone you owe', () => {
    const owe = g('chalet', 8 * 864e5, [exp('a', 30000, { me: 10000, a: 10000, b: 10000 })]);
    expect(dueNudges([owe], isMe, { now, lastActivity })).toEqual([]);
  });
  it('says it kindly, with your payment link when you have one', () => {
    expect(nudgeText('Alex', '£100.00', 'Lisbon')).toMatch(/^Hi Alex! A friendly nudge from settlr: you owe me £100\.00 for Lisbon\. No rush/);
    expect(nudgeText('Alex', '£100.00', 'Lisbon', { name: 'Monzo', url: 'https://monzo.me/t/100.00' })).toMatch(/You can pay me with Monzo at https:\/\/monzo\.me\/t\/100\.00, and here’s the group:$/);
  });
});

describe('nudge frequency and message', () => {
  it('waits longer between reminders when set to fortnightly or monthly', () => {
    const quiet = { ...lisbon, quiet: 10 * 864e5 };
    expect(dueNudges([quiet], isMe, { now, lastActivity, every: frequencyMs('fortnightly') })).toEqual([]);
    expect(dueNudges([quiet], isMe, { now, lastActivity, every: frequencyMs('weekly') })).toHaveLength(2);
    expect(frequencyMs('monthly')).toBe(30 * 864e5);
  });
  it('puts the link inside the message so it survives sharing', () => {
    expect(nudgeMessage('Hi Alex!', 'https://x.test/#/g/1')).toBe('Hi Alex! https://x.test/#/g/1');
  });
});
