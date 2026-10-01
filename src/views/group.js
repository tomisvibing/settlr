import { state, takeJustPaid } from '../store.js';
import { $, esc, money, byNewest, ago } from '../lib/format.js';
import { balances, settlements } from '../lib/ledger.js';
import { group, shortName, isMe, spentIn, isArchived } from '../selectors.js';
import { avatar, icon } from './shared.js';
import { beam } from './beam.js';
import { receipt } from './receipt.js';

const nameOf = pid => isMe(pid) ? 'You' : shortName(pid);
const words = n => ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n] || String(n);

/* Where each member's balance comes from, for the line's tooltip */
function breakdown(g, pid){
  let paid = 0, share = 0, sent = 0, got = 0;
  for(const e of g.expenses){
    if(e.type === 'payment'){ if(e.paidBy === pid) sent += e.amount; got += e.splits[pid] || 0; }
    else { if(e.paidBy === pid) paid += e.amount; share += e.splits[pid] || 0; }
  }
  const m = v => money(v, g.currency);
  return [`Paid ${m(paid)}, share ${m(share)}`, sent && `paid back ${m(sent)}`, got && `received ${m(got)}`].filter(Boolean).join(' · ');
}

/* One payment that settles part of the group: from → to, how much, and Mark paid */
function move(p, cur, frozen, paid = false){
  const side = pid => `${avatar(pid, 'sm')}<b>${isMe(pid) ? (p.from === pid ? 'You' : 'you') : esc(shortName(pid))}</b>`;
  return `<li class="move${isMe(p.from) ? ' mine' : ''}${paid ? ' paid' : ''}">
    <span class="m-who">${side(p.from)}<svg class="m-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="pays"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${side(p.to)}</span>
    <span class="m-amt">${money(p.amount, cur)}</span>
    ${paid ? '<span class="stamp" role="status">Paid</span>' : frozen ? '' : `<button class="btn small" data-action="settle" data-from="${p.from}" data-to="${p.to}" data-amount="${p.amount}">Mark paid</button>`}
  </li>`;
}

export function renderGroupView(id){
  const app = $('#app');
  state.activeGroupId = id;
  const g = group();
  if(!g){
    app.innerHTML = `<section class="empty">
      <h1 class="display">This group isn’t available. It may have been deleted, or you’re no longer in it.</h1>
      <a class="btn primary" href="#/overview">Back to your groups</a>
    </section>`;
    return;
  }
  const cur = g.currency, b = balances(g);
  const plan = settlements(b);
  const sorted = [...g.expenses].sort(byNewest);
  const n = g.members.length;
  const frozen = isArchived(g);
  const justPaid = takeJustPaid(g.id);
  const rows = g.members.slice().sort((a, c) => (b[c] || 0) - (b[a] || 0) || (isMe(c) - isMe(a))).map(pid => {
    const v = b[pid] || 0, nm = nameOf(pid);
    const say = v > 0 ? `${nm} ${isMe(pid) ? 'are' : 'is'} owed ${money(v, cur)}` : v < 0 ? `${nm} owe${isMe(pid) ? '' : 's'} ${money(-v, cur)}` : `${nm} ${isMe(pid) ? 'are' : 'is'} square`;
    return { pid, name: nm, value: v, say, tip: breakdown(g, pid) };
  });

  app.innerHTML = `<div class="stack">
    <div class="topbar">
      <a class="iconbtn" href="#/overview" aria-label="Back to all groups">${icon.back}</a>
      <span class="sp"></span>
      <button class="btn small topbar-invite" data-action="invite" aria-label="Invite people">${icon.invite}<span class="lbl">Invite</span></button>
      <button class="iconbtn" data-action="history" aria-label="History" title="History">${icon.history}</button>
      <button class="iconbtn" data-action="edit-group" aria-label="Edit group" title="Edit group">${icon.edit}</button>
      <button class="iconbtn" data-action="export-group" aria-label="Export as CSV" title="Export as CSV" ${g.expenses.length ? '' : 'disabled'}>${icon.download}</button>
    </div>

    <header class="page-head">
      <p class="kicker">${n} ${n === 1 ? 'person' : 'people'} · ${esc(cur)}${frozen ? ' · Archived' : ''}</p>
      <h1 class="display">${esc(g.name)}</h1>
      <p class="sub">${money(spentIn(g), cur)} spent${g.expenses.length ? ` · last added ${ago(sorted[0].createdAt)}` : ''}</p>
    </header>
    ${frozen ? `<div class="archived-note" role="status">${icon.archive}<p><b>Archived ${ago(g.archivedAt)}.</b> It’s frozen: nobody can add or change anything until it’s restored.</p><button class="btn small" data-action="restore-group">Restore</button></div>` : ''}

    ${n > 1 && g.expenses.length ? `<section class="section" aria-labelledby="upDown">
      <div class="section-head"><h2 id="upDown">Who’s up, who’s down</h2></div>
      ${beam(rows, cur, `Balances in ${g.name}`)}
      <p class="caption">The line in the middle is square. Bars are to scale.</p>
    </section>` : ''}

    <section class="section" aria-labelledby="settleHead">
      <div class="section-head"><h2 id="settleHead">${plan.length ? `${words(plan.length)} payment${plan.length === 1 ? ' settles' : 's settle'} it` : 'Settle up'}</h2>${frozen ? '' : `<button class="btn small" data-action="add-payment" ${n > 1 ? '' : 'disabled'}>Record a payment</button>`}</div>
      ${plan.length || justPaid ? `<ul class="moves">${justPaid ? move(justPaid, cur, frozen, true) : ''}${plan.map(p => move(p, cur, frozen)).join('')}</ul>` : ''}
      ${!plan.length ? `<p class="square-line">${g.expenses.length ? 'Square. Nobody owes anybody.' : 'Nothing to settle yet. Add the first expense with the + button.'}</p>` : ''}
    </section>

    <section class="section" aria-labelledby="receiptHead">
      <div class="section-head"><h2 id="receiptHead">The receipt so far</h2></div>
      ${sorted.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search this group" aria-label="Search this group" autocomplete="off">` : ''}
      ${sorted.length ? receipt(sorted.map(e => ({ e, g })), { title: g.name, foot: 'Keep the receipts. We did.' }) : `<p class="none">No expenses yet.</p>`}
    </section>
  </div>`;
}
