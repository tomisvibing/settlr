import { state } from '../store.js';
import { $, esc, money, byNewest, dayMonth } from '../lib/format.js';
import { personName, shortName, groupsOf, personCurrencyTotals, isMe } from '../selectors.js';
import { avatar, swipeActs } from './shared.js';
import { standings } from './standings.js';
import { plainReceipt, lineHTML } from './receipt.js';

const nameOf = pid => isMe(pid) ? 'You' : shortName(pid);

/* Everyone in words: who's up and who's down across all your groups, in each currency. People with nothing owed
   either way sit underneath as "All square" */
export function renderPeopleView(){
  const app = $('#app');
  const people = state.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  const settlements = state.payments.slice().sort(byNewest);
  const rows = [], square = [];
  for(const p of people){
    const amounts = Object.entries(personCurrencyTotals(p.id)).filter(([, v]) => v !== 0);
    if(!amounts.length){ square.push(p); continue; }
    const gnames = groupsOf(p.id).map(g => g.name);
    rows.push({ pid: p.id, name: nameOf(p.id), amounts, sub: gnames.length ? `In ${gnames.join(', ')}` : 'Settlements outside groups' });
  }
  /* Owed most first, then the biggest owing last */
  const score = r => r.amounts.reduce((m, [, v]) => Math.abs(v) > Math.abs(m) ? v : m, 0);
  rows.sort((a, c) => score(c) - score(a));

  app.innerHTML = `<div class="stack">
    <header class="page-head">
      <h1 class="display">Your people</h1>
      <p class="sub serif">Who’s up and who’s down, across every group.</p>
    </header>

    <section class="section" aria-labelledby="everyoneHead">
      <div class="section-head"><h2 id="everyoneHead">Everyone</h2><div class="chipbar">${people.length ? '<button class="btn small" data-action="manage-people">Edit</button>' : ''}<button class="btn small" data-action="add-person">Add a person</button></div></div>
      ${rows.length ? standings(rows, 'Balances with everyone') : ''}
      ${square.length ? `<div class="square-people">
        <h3>${rows.length ? 'All square' : 'Everyone’s square'}</h3>
        <ul class="opts">${square.map(p => `<li><span class="opt">${avatar(p.id, 'sm')}${esc(isMe(p.id) ? 'You' : personName(p.id))}</span></li>`).join('')}</ul>
      </div>` : ''}
      ${!people.length ? `<p class="none">No one saved yet. Add a person to get started.</p>` : ''}
    </section>

    <section class="section" aria-labelledby="outsideHead">
      <div class="section-head"><h2 id="outsideHead">Settled outside groups</h2><button class="btn small" data-action="add-settlement" ${people.length > 1 ? '' : 'disabled'}>Record a settlement</button></div>
      ${settlements.length ? plainReceipt('Outside groups', settlements.map(p => {
        const { day, mon } = dayMonth(p);
        return lineHTML({
          what: `${esc(nameOf(p.from))} <span aria-hidden="true">→</span><span class="sr"> paid </span> ${esc(isMe(p.to) ? 'you' : shortName(p.to))}`,
          amt: money(p.amount, p.currency),
          sub: `${esc(p.note || 'Settlement')} · ${day} ${mon}`,
          attrs: `data-action="edit-settlement" data-id="${p.id}"`,
          swipe: swipeActs('edit-settlement', 'del-settlement', p.id),
        });
      })) : `<p class="none">When two people settle up outside any group, record it here.</p>`}
    </section>
  </div>`;
}
