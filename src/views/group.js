import { state } from '../store.js';
import { $, esc, money, byNewest } from '../lib/format.js';
import { balances, settlements } from '../lib/ledger.js';
import { group, personName, isMe, spentIn } from '../selectors.js';
import { entryInner } from './shared.js';

export function renderGroupView(id){
  const app = $('#app');
  state.activeGroupId = id;
  const g = group();
  if(!g){
    app.innerHTML = `
      <section class="empty">
        <h1>This group isn't available. It may have been deleted, or you're no longer in it.</h1>
        <a class="btn primary" href="#/">Back to your groups</a>
      </section>`;
    return;
  }
  const cur = g.currency, b = balances(g);
  const max = Math.max(1, ...Object.values(b).map(Math.abs));
  const plan = settlements(b);
  const sorted = [...g.expenses].sort(byNewest);
  const pays = (from, to) => `${isMe(from) ? '<b>You</b> pay' : `<b>${esc(personName(from))}</b> pays`} ${isMe(to) ? '<b>you</b>' : `<b>${esc(personName(to))}</b>`}`;

  app.innerHTML = `
    <a class="back" href="#/">← All groups</a>
    <section class="hero" style="padding-top:.5rem">
      <h1>${esc(g.name)}</h1>
      <p class="sub">${g.members.length} ${g.members.length===1?'person':'people'}, ${money(spentIn(g),cur)} spent so far</p>
      <div class="ledger" role="list" aria-label="Balances">
        ${g.members.map(mid => {
          const v = b[mid], w = Math.round(Math.abs(v)/max*100), name = personName(mid);
          const cls = v>0?'pos':v<0?'neg':'zero';
          const label = v>0?`${money(v,cur)}<small>is owed</small>`:v<0?`${money(-v,cur)}<small>owes</small>`:`Square`;
          return `<div class="lrow" role="listitem">
            <span class="lname" title="${esc(name)}">${isMe(mid) ? 'You' : esc(name)}</span>
            <div class="lbar" aria-hidden="true">
              <div class="half neg"><i style="width:${v<0?w:0}%"></i></div>
              <div class="half pos"><i style="width:${v>0?w:0}%"></i></div>
            </div>
            <span class="lamt ${cls}">${label}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="toolbar">
        <button class="btn small" data-action="invite">Invite people</button>
        <button class="btn small" data-action="edit-group">Edit group</button>
        <button class="btn small" data-action="export-group" ${g.expenses.length?'':'disabled'}>Export CSV</button>
      </div>
    </section>

    <div class="actions">
      <button class="btn primary" data-action="add-expense" ${g.members.length?'':'disabled'}>Add expense</button>
      <button class="btn icon" data-action="voice-expense" ${g.members.length?'':'disabled'} aria-label="Add an expense by voice" title="Add an expense by voice">🎤</button>
      <button class="btn" data-action="add-payment" ${g.members.length>1?'':'disabled'}>Record payment</button>
    </div>

    <section class="block">
      <h2>To settle up</h2>
      ${plan.length ? `<ul class="list">${plan.map(p => `
        <li class="settle"><p>${pays(p.from, p.to)} ${money(p.amount,cur)}</p>
        <button class="btn small" data-action="settle" data-from="${p.from}" data-to="${p.to}" data-amount="${p.amount}">Mark paid</button></li>`).join('')}</ul>`
      : `<p class="none">${g.expenses.length ? 'Everyone is square.' : 'Add the first expense to see who owes whom.'}</p>`}
    </section>

    <section class="block">
      <h2>Activity</h2>
      ${sorted.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search activity" aria-label="Search activity" autocomplete="off">` : ''}
      ${sorted.length ? `<ul class="list" id="activityList">${sorted.map(e => {
        const isPay = e.type === 'payment';
        const hay = [isPay?'payment':e.desc, personName(e.paidBy), ...Object.keys(e.splits).map(personName), (e.amount/100).toFixed(2)].join(' ').toLowerCase();
        return `<li data-search="${esc(hay)}"><button class="item ${isPay?'payment':''}" data-action="${isPay?'edit-payment':'edit-expense'}" data-id="${e.id}">${entryInner(e, g, false)}</button></li>`;
      }).join('')}</ul><p class="none" id="noMatches" hidden>Nothing matches that search.</p>` : `<p class="none">No expenses yet.</p>`}
    </section>`;
}
export function filterActivity(q){
  q = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#activityList > li').forEach(li => { const ok = !q || li.dataset.search.includes(q); li.hidden = !ok; if(ok) shown++; });
  const nm = $('#noMatches'); if(nm) nm.hidden = shown > 0;
}
