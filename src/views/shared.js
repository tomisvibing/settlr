import { esc, money, dayMonth, initial } from '../lib/format.js';
import { meIn, personName, isMe } from '../selectors.js';

/* A stable tint per person or group, so the same face always has the same colour */
export function tintOf(id){
  let h = 0;
  for(const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 't' + (1 + Math.abs(h) % 6);
}
export const avatar = (pid, size = '') =>
  `<span class="av ${size} ${tintOf(pid)}" aria-hidden="true">${esc(initial(personName(pid)))}</span>`;
export const groupTile = (g, size = '') =>
  `<span class="tile ${size} ${tintOf(g.id)}" aria-hidden="true">${esc(initial(g.name))}</span>`;

/* +€45.00 / −£20.00 / Settled */
export function balancePill(v, cur, zero = 'Settled'){
  if(v > 0) return `<span class="pill pos">+${money(v, cur)}</span>`;
  if(v < 0) return `<span class="pill neg">−${money(-v, cur)}</span>`;
  return `<span class="pill">${zero}</span>`;
}

const svg = (d, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  invite: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  cog: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.7),
  backspace: svg('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-5 6M12 9l5 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2),
};

/* What an entry did to my balance: + means I'm owed more, − means I owe more */
export function myLine(e, g){
  const me = meIn(g); if(!me) return '';
  const v = (e.paidBy === me ? e.amount : 0) - (e.splits[me] || 0);
  if(!v) return '';
  const isPay = e.type === 'payment';
  const word = v > 0 ? (isPay ? 'you paid' : 'you lent') : (isPay ? 'you received' : 'you borrowed');
  return `<span class="r-mine ${v>0?'pos':'neg'}">${word} ${money(Math.abs(v), g.currency)}</span>`;
}
const who = pid => isMe(pid) ? 'You' : esc(personName(pid));
export function entryMeta(e){
  const n = Object.keys(e.splits).length;
  if(e.type === 'payment') return `${who(e.paidBy)} paid ${isMe(Object.keys(e.splits)[0]) ? 'you' : esc(personName(Object.keys(e.splits)[0]))}`;
  return `${who(e.paidBy)} paid · ${e.splitMode==='exact'?'split by amount':e.splitMode==='shares'?'split by shares':`split ${n} ${n===1?'way':'ways'}`}`;
}
/* One activity row's contents; groupName adds the group in front of the meta line */
export function entryInner(e, g, groupName){
  const { day, mon } = dayMonth(e), isPay = e.type === 'payment';
  return `${avatar(e.paidBy)}
    <span class="r-main"><span class="r-title">${esc(isPay ? 'Payment' : e.desc)}</span><span class="r-meta">${groupName ? esc(g.name) + ' · ' : ''}${entryMeta(e)} · ${day} ${mon}</span></span>
    <span class="r-end"><span class="r-amt">${money(e.amount, g.currency)}</span>${myLine(e, g)}</span>`;
}
