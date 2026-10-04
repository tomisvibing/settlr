/* Read-only lookups over the loaded state */
import { state, session } from './store.js';
import { accountPhoto } from './lib/avatar.js';
import { esc } from './lib/format.js';
import { balances } from './lib/ledger.js';

/* Archived groups are frozen: readable, but no new or changed entries (the database enforces it) */
export const isArchived = g => !!g?.archivedAt;
export const activeGroups = () => state.groups.filter(g => !g.archivedAt);
export function group(){ return state.groups.find(x => x.id === state.activeGroupId) || null; }
export function person(id){ return state.people.find(p => p.id === id) || { id, name:'Someone' }; }
export const personName = id => person(id).name;
/* First name where that's enough to tell people apart, the full name where it isn't */
export function shortName(id){
  const full = personName(id), first = full.split(' ')[0];
  return state.people.some(p => p.id !== id && p.name.split(' ')[0] === first) ? full : first;
}
/* "Me" can be several people rows: my own contact plus any placeholder I claimed when joining a group */
export const isMe = pid => state.myIds.has(pid);
export function meIn(g){ return g.members.find(isMe) || null; }
export function defaultPayer(g){ return meIn(g) || g.members[0]; }
/* A person's Google photo; my own falls back to my sign-in details until the database has it */
export const personPhoto = pid => person(pid).photo || (isMe(pid) ? accountPhoto(session?.user) : null);
export const nameWithYou = pid => esc(personName(pid)) + (isMe(pid) ? ' <span class="you">(you)</span>' : '');
export function lastActivity(g){ return g.expenses.reduce((m,e) => Math.max(m, e.createdAt), g.createdAt || 0); }
export function personLocked(pid){ return state.groups.some(g => g.members.includes(pid)) || state.payments.some(p => p.from===pid || p.to===pid); }
/* Runs the group: an admin, or anyone when no admin with an account is left (matches private.is_group_admin) */
export function canAdmin(g){
  const linkedAdmins = g.admins.filter(pid => person(pid).userId);
  return linkedAdmins.some(isMe) || (!linkedAdmins.length && !!meIn(g));
}
export const isAdmin = (g, pid) => g.admins.includes(pid);
export const hasAccount = pid => !!person(pid).userId;
/* Someone's Monzo, PayPal and Revolut usernames, if they've added them; and your own */
export const handlesOf = pid => state.payHandles[person(pid).userId] || null;
export const myHandles = () => state.payHandles[session?.user?.id] || null;
/* Everyone an entry's editor should see: current members plus anyone who has since left but is on this entry */
export function rosterFor(g, e){
  if(!e) return g.members;
  return [...new Set([...g.members, e.paidBy, ...Object.keys(e.splits)])];
}
export function involved(g, mid){ return g.expenses.some(e => e.paidBy === mid || mid in e.splits); }
export const spentIn = g => g.expenses.filter(e => e.type !== 'payment').reduce((s,e) => s+e.amount, 0);
/* Every group balance plus every standalone settlement, grouped by currency */
export function personCurrencyTotals(pid){
  const totals = {};
  state.groups.forEach(g => {
    if(!g.members.includes(pid)) return;
    const b = balances(g)[pid] || 0;
    totals[g.currency] = (totals[g.currency] || 0) + b;
  });
  state.payments.forEach(p => {
    if(p.from === pid) totals[p.currency] = (totals[p.currency] || 0) + p.amount;
    if(p.to === pid) totals[p.currency] = (totals[p.currency] || 0) - p.amount;
  });
  return totals;
}
export function myTotals(){
  const totals = {};
  state.myIds.forEach(pid => { for(const [c,v] of Object.entries(personCurrencyTotals(pid))) totals[c] = (totals[c]||0) + v; });
  return Object.entries(totals).filter(([,v]) => v !== 0);
}
