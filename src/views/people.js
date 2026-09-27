import { state } from '../store.js';
import { $, esc, money, byNewest, dayMonth } from '../lib/format.js';
import { personName, nameWithYou, groupsOf, personCurrencyTotals } from '../selectors.js';

export function renderPeopleView(){
  const app = $('#app');
  const people = state.people.slice().sort((a,b) => a.name.localeCompare(b.name));
  const activity = state.payments.slice().sort(byNewest);
  app.innerHTML = `
    <section class="hero">
      <h1>People</h1>
      <p class="sub" style="margin-bottom:0">Everyone you share expenses with, and where you stand with each of them across all groups.</p>
    </section>

    <div class="actions">
      <button class="btn primary" data-action="add-person">Add a person</button>
      <button class="btn" data-action="add-settlement" ${people.length>1?'':'disabled'}>Record a settlement</button>
    </div>

    <section class="block">
      <h2>Balances</h2>
      ${people.length ? `<ul class="list">${people.map(p => {
        const totals = Object.entries(personCurrencyTotals(p.id)).filter(([,v]) => v !== 0);
        const bal = totals.length
          ? `<div class="pbal">${totals.map(([c,v]) => `<span class="lamt ${v>0?'pos':'neg'}">${money(Math.abs(v),c)}<small>${v>0?'is owed':'owes'}</small></span>`).join('')}</div>`
          : `<span class="lamt zero">Square</span>`;
        const gnames = groupsOf(p.id).map(g => esc(g.name)).join(', ');
        return `<li><button class="item person" data-action="edit-person" data-id="${p.id}">
          <span class="pname"><span>${nameWithYou(p.id)}</span><span class="imeta">${gnames || 'Not in a group yet'}</span></span>
          ${bal}</button></li>`;
      }).join('')}</ul>` : `<p class="none">No one saved yet. Add a person to get started.</p>`}
    </section>

    <section class="block">
      <h2>Settlements outside a group</h2>
      ${activity.length ? `<ul class="list">${activity.map(p => {
        const { day, mon } = dayMonth(p);
        return `<li><button class="item payment" data-action="edit-settlement" data-id="${p.id}">
          <span class="idate"><b>${day}</b>${mon}</span>
          <span><span class="idesc">${esc(personName(p.from))} → ${esc(personName(p.to))}</span><span class="imeta">${esc(p.note || 'Settlement')}</span></span>
          <span class="iamt">${money(p.amount,p.currency)}</span></button></li>`;
      }).join('')}</ul>` : `<p class="none">Record a payment here when two people settle up outside any group's expenses.</p>`}
    </section>`;
}
