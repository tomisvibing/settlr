import { state } from '../store.js';
import { $, esc, money, byNewest, dayMonth } from '../lib/format.js';
import { personName, nameWithYou, groupsOf, personCurrencyTotals, personLocked, isMe } from '../selectors.js';
import { avatar, swipeActs } from './shared.js';

export function renderPeopleView(){
  const app = $('#app');
  const people = state.people.slice().sort((a,b) => a.name.localeCompare(b.name));
  const settlements = state.payments.slice().sort(byNewest);
  app.innerHTML = `<div class="stack">
    <div class="ghead" style="padding-top:8px"><div><h1>People</h1><p>Where everyone stands across all your groups.</p></div></div>

    <section class="section">
      <div class="section-head"><h2>Everyone</h2><button class="btn small" data-action="add-person">Add a person</button></div>
      <div class="card">${people.length ? `<ul class="rows">${people.map(p => {
        const totals = Object.entries(personCurrencyTotals(p.id)).filter(([,v]) => v !== 0);
        const bal = totals.length
          ? `<span class="r-end">${totals.map(([c,v]) => `<span class="pill ${v>0?'pos':'neg'}">${v>0?'is owed':'owes'} ${money(Math.abs(v),c)}</span>`).join('')}</span>`
          : `<span class="pill">Settled</span>`;
        const gnames = groupsOf(p.id).map(g => esc(g.name)).join(', ');
        /* Swipe for Edit and Delete, but only people who aren't in a group or settlement can be deleted */
        const locked = personLocked(p.id) || isMe(p.id);
        return `<li class="${locked ? '' : 'swipe'}"><button class="row" data-action="edit-person" data-id="${p.id}">
          ${avatar(p.id)}
          <span class="r-main"><span class="r-title">${nameWithYou(p.id)}</span><span class="r-meta">${gnames || 'Not in a group yet'}</span></span>
          ${bal}</button>${locked ? '' : swipeActs('edit-person', 'del-person', p.id)}</li>`;
      }).join('')}</ul>` : `<p class="none">No one saved yet. Add a person to get started.</p>`}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Outside groups</h2><button class="btn small" data-action="add-settlement" ${people.length>1?'':'disabled'}>Record a settlement</button></div>
      <div class="card">${settlements.length ? `<ul class="rows">${settlements.map(p => {
        const { day, mon } = dayMonth(p);
        return `<li class="swipe"><button class="row payment" data-action="edit-settlement" data-id="${p.id}">
          ${avatar(p.from)}
          <span class="r-main"><span class="r-title">${esc(personName(p.from))} → ${esc(personName(p.to))}</span><span class="r-meta">${esc(p.note || 'Settlement')} · ${day} ${mon}</span></span>
          <span class="r-end"><span class="r-amt">${money(p.amount,p.currency)}</span></span></button>${swipeActs('edit-settlement', 'del-settlement', p.id)}</li>`;
      }).join('')}</ul>` : `<p class="none">When two people settle up outside any group, record it here.</p>`}</div>
    </section>
  </div>`;
}
