import { session, state, myPersonId } from './store.js';
import { byNewest, today, slug } from './lib/format.js';
import { csvCell } from './lib/csv.js';
import { personName } from './selectors.js';
import { inviteLink } from './router.js';
import { toast, download } from './ui.js';

export async function shareInvite(g){
  const url = inviteLink(g);
  if(navigator.share){
    try{ await navigator.share({ title: `Join ${g.name} on settlr`, text: `Join "${g.name}" on settlr to split expenses (invite code ${g.inviteCode}).`, url }); return; }
    catch(err){ if(err.name === 'AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(url); toast('Invite link copied.'); }
  catch(e){ window.prompt('Copy this invite link:', url); }
}
export function exportGroupCsv(g){
  const everyone = [...g.members, ...g.left];
  const rows = [['Date','Description','Type','Amount','Currency','Spent','Spent in','Rate','Paid by', ...everyone.map(personName)]];
  [...g.expenses].sort((a,c) => byNewest(c,a)).forEach(e => rows.push([
    e.date || '', e.type === 'payment' ? 'Payment' : e.desc, e.type === 'payment' ? 'Payment' : 'Expense',
    (e.amount/100).toFixed(2), g.currency,
    e.origCurrency ? (e.origAmount/100).toFixed(2) : '', e.origCurrency || '', e.origCurrency ? String(e.fxRate) : '',
    personName(e.paidBy),
    ...everyone.map(mid => e.splits[mid] ? (e.splits[mid]/100).toFixed(2) : '')
  ]));
  download(`${slug(g.name)}.csv`, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
export function exportAll(){
  const cents = v => (v/100).toFixed(2);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { name: personName(myPersonId), email: session.user.email || null },
    groups: state.groups.map(g => ({
      name: g.name, currency: g.currency, inviteCode: g.inviteCode, members: g.members.map(personName),
      entries: [...g.expenses].sort(byNewest).map(e => ({
        date: e.date, type: e.type, description: e.type === 'payment' ? 'Payment' : e.desc, amount: cents(e.amount),
        paidBy: personName(e.paidBy), splitMode: e.splitMode,
        splits: Object.fromEntries(Object.entries(e.splits).map(([id,v]) => [personName(id), cents(v)]))
      }))
    })),
    people: state.people.map(p => p.name).sort(),
    settlements: state.payments.slice().sort(byNewest).map(p => ({ date: p.date, from: personName(p.from), to: personName(p.to), amount: cents(p.amount), currency: p.currency, note: p.note || null })),
  };
  download(`settlr-export-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
}
