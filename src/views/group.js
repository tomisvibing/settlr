import { state } from '../store.js';
import { $, esc, money, byNewest, ago } from '../lib/format.js';
import { balances, settlements } from '../lib/ledger.js';
import { group, personName, isMe, spentIn, isAdmin, isArchived } from '../selectors.js';
import { avatar, groupTile, balancePill, entryInner, icon, swipeActs } from './shared.js';

/* Search text for an activity row: description, the people in it and the amount */
export function searchText(e){
  return [e.type === 'payment' ? 'payment' : e.desc, personName(e.paidBy), ...Object.keys(e.splits).map(personName), (e.amount/100).toFixed(2)].join(' ').toLowerCase();
}
export function activityList(entries, g0, withGroup){
  return `<ul class="rows" id="activityList">${entries.map(({ e, g }) => {
    const isPay = e.type === 'payment';
    const editAction = isPay ? 'edit-payment' : 'edit-expense';
    const search = esc(searchText(e) + (withGroup ? ' ' + g.name.toLowerCase() : ''));
    /* Archived groups are read-only: plain rows, nothing to tap or swipe */
    if(isArchived(g)) return `<li data-search="${search}"><div class="row ${isPay ? 'payment' : ''}">${entryInner(e, g, withGroup)}</div></li>`;
    return `<li class="swipe" data-search="${esc(searchText(e) + (withGroup ? ' ' + g.name.toLowerCase() : ''))}"><button class="row ${isPay ? 'payment' : ''}" data-action="${editAction}" data-id="${e.id}" data-group="${g.id}">${entryInner(e, g, withGroup)}</button>${swipeActs(editAction, 'del-entry', e.id, g.id)}</li>`;
  }).join('')}</ul><p class="none" id="noMatches" hidden>Nothing matches that search.</p>`;
}

export function renderGroupView(id){
  const app = $('#app');
  state.activeGroupId = id;
  const g = group();
  if(!g){
    app.innerHTML = `<section class="empty">
      <h1>This group isn’t available. It may have been deleted, or you’re no longer in it.</h1>
      <a class="btn primary" href="#/">Back to your groups</a>
    </section>`;
    return;
  }
  const cur = g.currency, b = balances(g);
  const plan = settlements(b);
  const sorted = [...g.expenses].sort(byNewest);
  const pays = (from, to) => `${isMe(from) ? '<b>You</b> pay' : `<b>${esc(personName(from))}</b> pays`} ${isMe(to) ? '<b>you</b>' : `<b>${esc(personName(to))}</b>`}`;
  const members = g.members.slice().sort((a, c) => (isMe(c) - isMe(a)) || (b[c] - b[a]));
  const n = g.members.length;
  const frozen = isArchived(g);

  app.innerHTML = `<div class="stack">
    <div class="topbar">
      <a class="iconbtn" href="#/" aria-label="Back to all groups">${icon.back}</a>
      <span class="sp"></span>
      <button class="btn small topbar-invite" data-action="invite" aria-label="Invite people">${icon.invite}<span class="lbl">Invite</span></button>
      <button class="iconbtn" data-action="history" aria-label="History" title="History">${icon.history}</button>
      <button class="iconbtn" data-action="edit-group" aria-label="Edit group" title="Edit group">${icon.edit}</button>
      <button class="iconbtn" data-action="export-group" aria-label="Export as CSV" title="Export as CSV" ${g.expenses.length ? '' : 'disabled'}>${icon.download}</button>
    </div>

    <div class="ghead">
      ${groupTile(g, 'lg')}
      <div class="ghead-title"><h1>${esc(g.name)}</h1><p>${n} ${n === 1 ? 'person' : 'people'} · ${money(spentIn(g), cur)} spent</p></div>
      ${frozen ? '' : `<button class="btn primary ghead-add" data-action="add-expense">${icon.plus}Add expense</button>`}
    </div>
    ${frozen ? `<div class="archived-note" role="status">${icon.archive}<p><b>Archived ${ago(g.archivedAt)}.</b> It’s frozen: nobody can add or change anything until it’s restored.</p><button class="btn small" data-action="restore-group">Restore</button></div>` : ''}

    <section class="card" aria-label="Balances">
      <ul class="rows">${members.map(mid => `<li class="row">
        ${avatar(mid)}
        <span class="r-main"><span class="r-title">${isMe(mid) ? 'You' : esc(personName(mid))}</span>${isAdmin(g, mid) ? '<span class="r-meta">Admin</span>' : ''}</span>
        ${balancePill(b[mid] || 0, cur)}
      </li>`).join('')}</ul>
    </section>

    <section class="section">
      <div class="section-head"><h2>Settle up</h2>${frozen ? '' : `<button class="btn small" data-action="add-payment" ${n > 1 ? '' : 'disabled'}>Record a payment</button>`}</div>
      ${plan.length ? `<ul class="settle">${plan.map(p => `
        <li class="${isMe(p.from) ? 'owe' : ''}"><p>${pays(p.from, p.to)} ${money(p.amount, cur)}</p>
        ${frozen ? '' : `<button class="btn small" data-action="settle" data-from="${p.from}" data-to="${p.to}" data-amount="${p.amount}">Mark paid</button>`}</li>`).join('')}</ul>`
      : `<div class="card"><p class="none">${g.expenses.length ? 'Everyone is square.' : 'Add the first expense to see who owes whom.'}</p></div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2>Activity</h2></div>
      ${sorted.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search activity" aria-label="Search activity" autocomplete="off">` : ''}
      <div class="card">${sorted.length ? activityList(sorted.map(e => ({ e, g })), g, false) : `<p class="none">No expenses yet. Add the first one with Add expense.</p>`}</div>
    </section>
  </div>`;
}
export function filterActivity(q){
  q = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#activityList > li').forEach(li => { const ok = !q || li.dataset.search.includes(q); li.hidden = !ok; if(ok) shown++; });
  const nm = $('#noMatches'); if(nm) nm.hidden = shown > 0;
}
