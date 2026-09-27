import { esc, money, dayMonth } from '../lib/format.js';
import { meIn, personName } from '../selectors.js';

/* What an entry did to my balance: + means I'm owed more, − means I owe more */
export function myLine(e, g){
  const me = meIn(g); if(!me) return '';
  const v = (e.paidBy === me ? e.amount : 0) - (e.splits[me] || 0);
  if(!v) return '';
  const isPay = e.type === 'payment';
  const word = v > 0 ? (isPay ? 'you paid' : 'you lent') : (isPay ? 'you received' : 'you borrowed');
  return `<small class="${v>0?'pos':'neg'}">${word} ${money(Math.abs(v), g.currency)}</small>`;
}
export function entryMeta(e){
  const n = Object.keys(e.splits).length;
  if(e.type === 'payment') return `${esc(personName(e.paidBy))} paid ${esc(personName(Object.keys(e.splits)[0]))}`;
  return `${esc(personName(e.paidBy))} paid, ${e.splitMode==='exact'?'split by amount':e.splitMode==='shares'?'split by shares':`split ${n} ${n===1?'way':'ways'}`}`;
}
export function entryInner(e, g, groupName){
  const { day, mon } = dayMonth(e), isPay = e.type === 'payment';
  return `<span class="idate"><b>${day}</b>${mon}</span>
    <span><span class="idesc">${esc(isPay?'Payment':e.desc)}</span><span class="imeta">${groupName ? esc(g.name) + ' · ' : ''}${entryMeta(e)}</span></span>
    <span class="iamt">${money(e.amount,g.currency)}${myLine(e,g)}</span>`;
}
