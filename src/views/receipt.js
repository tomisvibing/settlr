/* Spending printed like a till receipt: days in italics, dotted leaders to the price, your share
   underneath, a total at the foot. Used by Activity, a group's page and the overview */
import { $, esc, money } from '../lib/format.js';
import { byDay } from '../lib/days.js';
import { personName, isArchived } from '../selectors.js';
import { entryMeta, myLine, icon, swipeActs } from './shared.js';

/* Search text for an entry: description, the people in it and the amount */
export function searchText(e){
  return [e.type === 'payment' ? 'payment' : e.desc, personName(e.paidBy), ...Object.keys(e.splits).map(personName), (e.amount/100).toFixed(2)].join(' ').toLowerCase();
}
const iso = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateOf = ({ e }) => e.date || iso(e.createdAt);

/* One expense or payment as a receipt line. Archived groups are read-only: a plain line, nothing to tap */
function entryLine(e, g, withGroup){
  const isPay = e.type === 'payment', act = isPay ? 'edit-payment' : 'edit-expense';
  const what = `${e.receipt ? `<span class="clip" title="Has a receipt"><span class="sr">Has a receipt: </span>${icon.clip}</span>` : ''}${esc(isPay ? 'Payment' : e.desc)}${e.comments?.length ? `<span class="ccount" title="${e.comments.length} comment${e.comments.length === 1 ? '' : 's'}"><span class="sr">, ${e.comments.length} comments</span>${icon.comment}${e.comments.length}</span>` : ''}`;
  const shown = money(e.origCurrency ? e.origAmount : e.amount, e.origCurrency || g.currency);
  const conv = e.origCurrency ? ` · ${money(e.amount, g.currency)}` : '';
  const inner = `<span class="l-what">${what}</span><span class="l-dots" aria-hidden="true"></span><span class="l-amt">${shown}</span>
    <span class="l-sub"><span>${withGroup ? esc(g.name) + ' · ' : ''}${entryMeta(e)}${conv}</span>${myLine(e, g)}</span>`;
  const data = `data-search="${esc(searchText(e) + (withGroup ? ' ' + g.name.toLowerCase() : ''))}" data-g="${g.id}" data-cur="${g.currency}" data-amt="${isPay ? 0 : e.amount}"`;
  if(isArchived(g)) return `<li class="entry" ${data}><div class="line">${inner}</div></li>`;
  return `<li class="entry swipe" ${data}><button class="line${isPay ? ' payment' : ''}" data-action="${act}" data-id="${e.id}" data-group="${g.id}">${inner}</button>${swipeActs(act, 'del-entry', e.id, g.id)}</li>`;
}

/* Totals per currency, spending only (payments move money, they don't spend it) */
const totalsHTML = sums => {
  const parts = Object.entries(sums).filter(([, v]) => v);
  return parts.length ? parts.map(([c, v]) => money(v, c)).join(' · ') : money(0, Object.keys(sums)[0] || 'GBP');
};
/* The receipt's masthead: the wordmark and, if it has one, what the receipt is for */
const rHead = title => `<header class="r-head"><span class="serif">settlr</span>${title ? `<span class="r-sub">${esc(title)}</span>` : ''}</header>`;
export function receipt(entries, { title, withGroup = false, foot = '', id = 'activityList' } = {}){
  const sums = {};
  entries.forEach(({ e, g }) => { if(e.type !== 'payment') sums[g.currency] = (sums[g.currency] || 0) + e.amount; });
  return `<div class="till">
    ${rHead(title)}
    <ol class="r-lines" id="${id}">${byDay(entries, dateOf).map(d => `<li class="day-head"><h3 class="day">${d.label}</h3></li>${d.items.map(({ e, g }) => entryLine(e, g, withGroup)).join('')}`).join('')}</ol>
    <p class="none" id="noMatches" hidden>Nothing matches that search.</p>
    <div class="r-total"><span>Total spent</span><span class="l-dots" aria-hidden="true"></span><span id="receiptTotal">${totalsHTML(sums)}</span></div>
    ${foot ? `<p class="thanks">${esc(foot)}</p>` : ''}
  </div>`;
}

/* A receipt of plain lines (the People page's settlements), with the same look */
export function plainReceipt(title, lines, foot = ''){
  return `<div class="till">
    ${rHead(title)}
    <ol class="r-lines">${lines.join('')}</ol>
    ${foot ? `<p class="thanks">${esc(foot)}</p>` : ''}
  </div>`;
}
export const lineHTML = ({ what, amt, sub = '', right = '', attrs = '', swipe = '' }) =>
  `<li class="entry${swipe ? ' swipe' : ''}"><button class="line" ${attrs}><span class="l-what">${what}</span><span class="l-dots" aria-hidden="true"></span><span class="l-amt">${amt}</span><span class="l-sub"><span>${sub}</span>${right}</span></button>${swipe}</li>`;

/* Search and the group filter work together; a day with nothing left showing hides its heading,
   and the total follows what's on the receipt */
let onlyGroup = null;
export const activityGroup = () => onlyGroup;
export function setActivityGroup(gid){ onlyGroup = gid || null; filterActivity($('[data-filter=activity]')?.value || ''); }
export function resetActivityFilter(){ onlyGroup = null; }
export function filterActivity(q = ''){
  q = q.trim().toLowerCase();
  const list = $('#activityList'); if(!list) return;
  let shown = 0, head = null, headShown = false;
  const sums = {};
  /* The group filter belongs to Activity; a group's own page searches only */
  const only = document.body.dataset.route === 'activity' ? onlyGroup : null;
  const closeHead = () => { if(head) head.hidden = !headShown; };
  for(const li of list.children){
    if(li.classList.contains('day-head')){ closeHead(); head = li; headShown = false; continue; }
    const ok = (!q || li.dataset.search.includes(q)) && (!only || li.dataset.g === only);
    li.hidden = !ok;
    if(ok){ shown++; headShown = true; sums[li.dataset.cur] = (sums[li.dataset.cur] || 0) + (+li.dataset.amt || 0); }
  }
  closeHead();
  const nm = $('#noMatches'); if(nm) nm.hidden = shown > 0;
  const t = $('#receiptTotal'); if(t) t.textContent = totalsHTML(sums);
  document.querySelectorAll('[data-action="act-filter"]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.id || null) === onlyGroup)));
}
