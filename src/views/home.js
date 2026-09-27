import { state, myPersonId } from '../store.js';
import { $, esc, money, ago, byNewest, initial } from '../lib/format.js';
import { balances } from '../lib/ledger.js';
import { personName, meIn, lastActivity, spentIn, myTotals } from '../selectors.js';
import { groupHref } from '../router.js';
import { entryInner } from './shared.js';

export function renderHome(){
  const app = $('#app');
  const first = (personName(myPersonId) || '').split(' ')[0];
  if(!state.groups.length){
    app.innerHTML = `
      <section class="empty">
        <h1>${first ? `Welcome, ${esc(first)}. ` : ''}You're not part of any groups yet.</h1>
        <button class="btn primary" data-action="new-group">Start a group</button>
        <button class="btn" data-action="join-group" style="margin-top:.6rem">Join with an invite code</button>
      </section>`;
    return;
  }
  const totals = myTotals();
  const groups = state.groups.slice().sort((a,c) => lastActivity(c) - lastActivity(a));
  const recent = state.groups.flatMap(g => g.expenses.map(e => ({ e, g }))).sort((x,y) => byNewest(x.e, y.e)).slice(0, 6);
  app.innerHTML = `
    <section class="hero">
      <p class="sub" style="margin:0 0 .4rem">${first ? `Hi ${esc(first)} — here's` : "Here's"} where you stand</p>
      <div class="summary">${totals.length
        ? totals.map(([c,v]) => `<p class="big ${v>0?'pos':'neg'}">${v>0?"You're owed":'You owe'} ${money(Math.abs(v),c)}</p>`).join('')
        : `<p class="big">You're all square</p>`}</div>
      <p class="sub" style="margin:.35rem 0 0">Across ${state.groups.length} ${state.groups.length===1?'group':'groups'}${state.payments.length ? ' and your settlements' : ''}.</p>
    </section>

    <div class="actions">
      <button class="btn primary" data-action="new-group">New group</button>
      <button class="btn" data-action="join-group">Join a group</button>
    </div>

    <section class="block">
      <h2>Your groups</h2>
      <ul class="list">${groups.map(g => {
        const me = meIn(g), v = me ? (balances(g)[me] || 0) : 0, cur = g.currency;
        const status = !me ? `<span class="lamt zero">Not in it</span>`
          : v>0 ? `<span class="lamt pos">${money(v,cur)}<small>you're owed</small></span>`
          : v<0 ? `<span class="lamt neg">${money(-v,cur)}<small>you owe</small></span>`
          : `<span class="lamt zero">Square</span>`;
        const n = g.members.length;
        return `<li><a class="item gcard" href="${groupHref(g)}">
          <span class="gav ${v>0?'pos':v<0?'neg':''}" aria-hidden="true">${esc(initial(g.name))}</span>
          <span><span class="idesc">${esc(g.name)}</span><span class="imeta">${n} ${n===1?'person':'people'} · ${money(spentIn(g),cur)} spent · ${ago(lastActivity(g))}</span></span>
          ${status}</a></li>`;
      }).join('')}</ul>
    </section>

    <section class="block">
      <h2>Recent activity</h2>
      ${recent.length ? `<ul class="list">${recent.map(({e,g}) => `<li><a class="item ${e.type==='payment'?'payment':''}" href="${groupHref(g)}">${entryInner(e, g, true)}</a></li>`).join('')}</ul>`
        : `<p class="none">Nothing yet. Open a group and add the first expense.</p>`}
    </section>`;
}
