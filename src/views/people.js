import { state } from '../store.js';
import { $, esc, money, byNewest, dayMonth } from '../lib/format.js';
import { personName, shortName, groupsOf, personCurrencyTotals, isMe } from '../selectors.js';
import { avatar, swipeActs } from './shared.js';
import { beam } from './beam.js';
import { plainReceipt, lineHTML } from './receipt.js';

const nameOf = pid => isMe(pid) ? 'You' : shortName(pid);

/* Everyone on one up-and-down line, one line per currency (bars only compare within a currency).
   Tap a person to edit them; people with nothing owed either way sit underneath as "All square" */
export function renderPeopleView(){
  const app = $('#app');
  const people = state.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  const settlements = state.payments.slice().sort(byNewest);
  const byCur = {}, square = [];
  for(const p of people){
    const totals = Object.entries(personCurrencyTotals(p.id)).filter(([, v]) => v !== 0);
    if(!totals.length){ square.push(p); continue; }
    const gnames = groupsOf(p.id).map(g => g.name).join(', ');
    for(const [cur, v] of totals){
      const nm = nameOf(p.id), you = isMe(p.id);
      const say = v > 0 ? `${nm} ${you ? 'are' : 'is'} owed ${money(v, cur)}` : `${nm} owe${you ? '' : 's'} ${money(-v, cur)}`;
      (byCur[cur] ||= []).push({ pid: p.id, name: nm, value: v, say, tip: gnames ? `In ${gnames}` : 'Settlements outside groups', action: 'edit-person' });
    }
  }
  const curs = Object.keys(byCur).sort((a, c) => byCur[c].length - byCur[a].length);
  const lines = curs.map((cur, i) => `${curs.length > 1 ? `<h3 class="beam-cur">In ${esc(cur)}</h3>` : ''}
    ${beam(byCur[cur].sort((a, c) => c.value - a.value), cur, `Balances in ${cur}`, { legend: i === 0 })}`).join('');

  app.innerHTML = `<div class="stack">
    <header class="page-head">
      <h1 class="display">Your people</h1>
      <p class="sub serif">Who’s up and who’s down, across every group.</p>
    </header>

    <section class="section" aria-labelledby="everyoneHead">
      <div class="section-head"><h2 id="everyoneHead">Everyone</h2><button class="btn small" data-action="add-person">Add a person</button></div>
      ${curs.length ? `${lines}<p class="caption">The line in the middle is square. Tap someone to see or change their details.</p>` : ''}
      ${square.length ? `<div class="square-people">
        <h3>${curs.length ? 'All square' : 'Everyone’s square'}</h3>
        <ul class="opts">${square.map(p => `<li><button class="opt" data-action="edit-person" data-id="${p.id}">${avatar(p.id, 'sm')}${esc(isMe(p.id) ? 'You' : personName(p.id))}</button></li>`).join('')}</ul>
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
