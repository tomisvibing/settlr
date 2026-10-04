import { state, takeJustPaid } from '../store.js';
import { $, esc, money, byNewest, ago } from '../lib/format.js';
import { balances, settlements } from '../lib/ledger.js';
import { group, shortName, isMe, spentIn, isArchived, handlesOf } from '../selectors.js';
import { payLinks } from '../lib/paylinks.js';
import { avatar, icon } from './shared.js';
import { standings } from './standings.js';
import { nudgedAt } from '../nudge.js';
import { receipt } from './receipt.js';
import { nextDate, frequencyLabel } from '../lib/recurring.js';
import { insights, monthLabel } from '../lib/insights.js';
import { categoryLabel } from '../lib/categories.js';

const nameOf = pid => isMe(pid) ? 'You' : shortName(pid);

/* Where each member's balance comes from, under their line */
function breakdown(g, pid){
  let paid = 0, share = 0, sent = 0, got = 0;
  for(const e of g.expenses){
    if(e.type === 'payment'){ if(e.paidBy === pid) sent += e.amount; got += e.splits[pid] || 0; }
    else { if(e.paidBy === pid) paid += e.amount; share += e.splits[pid] || 0; }
  }
  const m = v => money(v, g.currency);
  return [`Paid ${m(paid)}, share ${m(share)}`, sent && `paid back ${m(sent)}`, got && `received ${m(got)}`].filter(Boolean).join(' · ');
}

/* One payment that settles part of the group: from → to, how much, and Mark paid. When it's
   owed to you, there's a Nudge too */
function move(g, p, frozen, paid = false){
  const side = pid => `${avatar(pid, 'sm')}<b>${isMe(pid) ? (p.from === pid ? 'You' : 'you') : esc(shortName(pid))}</b>`;
  const toMe = isMe(p.to) && !isMe(p.from), when = toMe ? nudgedAt(g.id, p.from) : 0;
  /* You owe: buttons that open their payment app with the amount filled in */
  const pay = isMe(p.from) && !isMe(p.to) ? payLinks(handlesOf(p.to), p.amount, g.currency, g.name) : [];
  const acts = paid ? '<span class="stamp" role="status">Paid</span>' : frozen ? '' : `<span class="m-acts">
      ${pay.map(l => `<a class="btn small primary" href="${l.url}" target="_blank" rel="noopener"${l.filled ? '' : ` title="Opens ${l.name}; type ${money(p.amount, g.currency)}"`}>Pay with ${l.name}</a>`).join('')}
      ${toMe ? `<button class="btn small" data-action="nudge" data-group="${g.id}" data-id="${p.from}" data-amount="${p.amount}">Nudge</button>` : ''}
      <button class="btn small" data-action="settle" data-from="${p.from}" data-to="${p.to}" data-amount="${p.amount}">Mark paid</button>
      ${when ? `<span class="m-note">Nudged ${ago(when)}</span>` : ''}
    </span>`;
  return `<li class="move${isMe(p.from) ? ' mine' : ''}${paid ? ' paid' : ''}">
    <span class="m-who">${side(p.from)}<svg class="m-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="pays"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${side(p.to)}</span>
    <span class="m-amt">${money(p.amount, g.currency)}</span>
    ${acts}
  </li>`;
}

/* The schedules that add an expense by themselves, each with a Stop */
function repeating(g, frozen){
  if(!g.recurring.length) return '';
  const when = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<section class="section" aria-labelledby="repeatHead">
    <div class="section-head"><h2 id="repeatHead">Repeating</h2></div>
    <ul class="moves">${g.recurring.map(r => { const next = nextDate(r); return `<li class="move">
      <span class="m-who"><b>${esc(r.desc)}</b></span>
      <span class="m-amt">${money(r.amount, g.currency)}</span>
      <span class="m-acts"><span class="m-note">${esc(frequencyLabel(r.frequency))}${next ? ` · next ${when(next)}` : ' · finished'}</span>
        ${frozen ? '' : `<button class="btn small" data-action="stop-recurring" data-group="${g.id}" data-id="${r.id}" data-desc="${esc(r.desc)}">Stop</button>`}</span>
    </li>`; }).join('')}</ul>
  </section>`;
}

/* Where the money went: by month, who paid most, and the biggest single expense */
function spending(g){
  const i = insights(g);
  if(i.count < 2) return '';
  const m = v => money(v, g.currency), top = Math.max(...i.byMonth.map(x => x.amount), 1);
  const lead = i.paidBy[0];
  return `<section class="section" aria-labelledby="spendHead">
    <div class="section-head"><h2 id="spendHead">Where it went</h2></div>
    <p class="spend-lead">${i.count} expenses, <b>${m(i.total)}</b> in all${lead && g.members.length > 1 ? `. ${isMe(lead.pid) ? 'You' : esc(shortName(lead.pid))} paid the most, <b>${m(lead.amount)}</b>` : ''}${i.biggest ? `. The biggest was <b>${esc(i.biggest.desc)}</b> at ${m(i.biggest.amount)}` : ''}.</p>
    ${i.byCategory.some(x => x.category) ? `<ul class="bars" aria-label="Spending by category">${i.byCategory.map(x => `<li><span class="b-lbl">${categoryLabel(x.category)}</span><span class="b-track" aria-hidden="true"><span class="b-fill" style="width:${Math.max(2, Math.round(x.amount / i.byCategory[0].amount * 100))}%"></span></span><span class="b-amt">${m(x.amount)}</span></li>`).join('')}</ul>` : ''}
    ${i.byMonth.length > 1 ? `<ul class="bars" aria-label="Spending by month">${i.byMonth.map(x => `<li><span class="b-lbl">${monthLabel(x.month)}</span><span class="b-track" aria-hidden="true"><span class="b-fill" style="width:${Math.max(2, Math.round(x.amount / top * 100))}%"></span></span><span class="b-amt">${m(x.amount)}</span></li>`).join('')}</ul>` : ''}
  </section>`;
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
    return { pid, name: nameOf(pid), amounts: [[cur, b[pid] || 0]], sub: breakdown(g, pid) };
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
      <h1 class="display">${esc(g.name)}</h1>
      <p class="sub">${money(spentIn(g), cur)} spent${g.expenses.length ? ` · last added ${ago(sorted[0].createdAt)}` : ''}</p>
      ${frozen ? '' : `<button class="btn primary add-here" data-action="add-expense">${icon.plus}Add an expense</button>`}
    </header>
    ${frozen ? `<div class="archived-note" role="status">${icon.archive}<p><b>Archived ${ago(g.archivedAt)}.</b> It’s frozen: nobody can add or change anything until it’s restored.</p><button class="btn small" data-action="restore-group">Restore</button></div>` : ''}

    ${n > 1 && g.expenses.length ? `<section class="section" aria-labelledby="upDown">
      <div class="section-head"><h2 id="upDown">Who’s up, who’s down</h2></div>
      ${standings(rows, `Balances in ${g.name}`)}
    </section>` : ''}

    <section class="section" aria-labelledby="settleHead">
      <div class="section-head"><h2 id="settleHead">${plan.length ? 'Time to settle up' : 'Settle up'}</h2>${frozen ? '' : `<button class="btn small" data-action="add-payment" ${n > 1 ? '' : 'disabled'}>Record a payment</button>`}</div>
      ${plan.length || justPaid ? `<ul class="moves">${justPaid ? move(g, justPaid, frozen, true) : ''}${plan.map(p => move(g, p, frozen)).join('')}</ul>` : ''}
      ${!plan.length ? `<p class="square-line">${g.expenses.length ? 'Square. Nobody owes anybody.' : 'Nothing to settle yet. Add the first expense with the + button.'}</p>` : ''}
    </section>

    ${spending(g)}

    ${repeating(g, frozen)}

    <section class="section" aria-labelledby="receiptHead">
      <div class="section-head"><h2 id="receiptHead">The receipt so far</h2></div>
      ${sorted.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search this group" aria-label="Search this group" autocomplete="off">` : ''}
      ${sorted.length ? receipt(sorted.map(e => ({ e, g })), { title: g.name, foot: 'Keep the receipts. We did.' }) : `<p class="none">No expenses yet.</p>`}
    </section>
  </div>`;
}
