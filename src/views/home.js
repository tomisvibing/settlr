import { state, myPersonId } from '../store.js';
import { $, esc, money, ago, byNewest } from '../lib/format.js';
import { balances } from '../lib/ledger.js';
import { personName, meIn, lastActivity, myTotals, isArchived, canAdmin } from '../selectors.js';
import { groupHref } from '../router.js';
import { avatar, groupTile, balancePill, icon, swipeButtons } from './shared.js';
import { activityList } from './group.js';

/* Whether the Archived list is open, kept across re-renders (live updates redraw the page) */
let archivedOpen = false;

/* One group card; swipe it left for Edit, Archive and Delete (or Restore when archived) */
function groupCard(g){
  const me = meIn(g), v = me ? (balances(g)[me] || 0) : 0, n = g.members.length;
  const del = canAdmin(g) ? [['del-group', 'Delete', icon.trash, 'del']] : [];
  const acts = isArchived(g)
    ? [['restore-group', 'Restore', icon.restore], ...del]
    : [['edit-group', 'Edit', icon.edit], ['archive-group', 'Archive', icon.archive], ...del];
  const when = isArchived(g) ? `archived ${ago(g.archivedAt)}` : ago(lastActivity(g));
  return `<li class="swipe"><a class="card gcard" href="${groupHref(g)}">
    ${groupTile(g)}
    <span class="r-main"><span class="r-title lead">${esc(g.name)}</span><span class="r-meta">${n} ${n === 1 ? 'person' : 'people'} · ${when}</span></span>
    ${me ? balancePill(v, g.currency) : '<span class="pill">Not in it</span>'}
  </a>${swipeButtons(acts, g.id, g.id)}</li>`;
}

const greeting = (h = new Date().getHours()) => h < 5 ? 'Evening,' : h < 12 ? 'Morning,' : h < 18 ? 'Afternoon,' : 'Evening,';
const joinMoney = list => list.map(([c, v]) => money(Math.abs(v), c)).join(' · ');

function greetRow(){
  const name = personName(myPersonId) || '';
  return `<div class="greet">
    ${avatar(myPersonId, 'lg')}
    <div class="who"><small>${greeting()}</small><b>${esc(name.split(' ')[0] || 'there')}</b></div>
    <a class="iconbtn" href="#/settings" aria-label="Settings">${icon.cog}</a>
  </div>`;
}

/* The dark "where you stand" card: the biggest amount owed to you (or that you owe) up top */
function heroCard(){
  const totals = myTotals().sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]));
  const owed = totals.filter(([, v]) => v > 0), owe = totals.filter(([, v]) => v < 0);
  const mine = state.groups.map(g => ({ g, me: meIn(g) })).filter(x => x.me);
  const bal = mine.map(({ g, me }) => balances(g)[me] || 0);
  const owedIn = bal.filter(v => v > 0).length, oweIn = bal.filter(v => v < 0).length, settled = bal.filter(v => v === 0).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let big, sub;
  if(owed.length){
    big = `<div class="hero-big pos">+${money(owed[0][1], owed[0][0])}</div>${owed.length > 1 ? `<div class="hero-extra">+${joinMoney(owed.slice(1))}</div>` : ''}`;
    sub = owedIn ? `you’re owed in ${plural(owedIn, 'group')}` : 'you’re owed';
  } else if(owe.length){
    big = `<div class="hero-big neg">−${money(-owe[0][1], owe[0][0])}</div>`;
    sub = oweIn ? `you owe in ${plural(oweIn, 'group')}` : 'you owe';
  } else {
    big = `<div class="hero-big">All square</div>`;
    sub = 'nobody owes anybody';
  }
  const tile1 = owed.length
    ? `<div class="hero-tile"><span>You owe</span><b class="${owe.length ? 'neg' : ''}">${owe.length ? joinMoney(owe) : 'Nothing'}</b></div>`
    : `<div class="hero-tile"><span>You’re owed</span><b>Nothing</b></div>`;
  return `<section class="hero-card" aria-label="Where you stand">
    <div class="eyebrow">Where you stand</div>
    <div>${big}<div class="hero-sub">${sub}</div></div>
    <div class="hero-tiles">${tile1}<div class="hero-tile"><span>Settled</span><b>${plural(settled, 'group')}</b></div></div>
  </section>`;
}

export function renderHome(){
  const app = $('#app');
  if(!state.groups.length){
    app.innerHTML = `<div class="stack">
      ${greetRow()}
      <section class="card empty" style="min-height:0;padding:36px 20px">
        <h1>Start a group to split your first bill.</h1>
        <button class="btn primary" data-action="new-group">Start a group</button>
        <button class="btn" data-action="join-group">Join with an invite code</button>
      </section>
    </div>`;
    return;
  }
  const byRecent = (a, c) => lastActivity(c) - lastActivity(a);
  const groups = state.groups.filter(g => !isArchived(g)).sort(byRecent);
  const archived = state.groups.filter(isArchived).sort((a, c) => c.archivedAt - a.archivedAt);
  const recent = state.groups.flatMap(g => g.expenses.map(e => ({ e, g }))).sort((x, y) => byNewest(x.e, y.e)).slice(0, 5);
  app.innerHTML = `<div class="stack">
    ${greetRow()}
    ${heroCard()}

    <section class="section">
      <div class="section-head">
        <h2>Your groups</h2>
        <div class="chipbar"><button class="btn small" data-action="join-group">Join</button><button class="btn small" data-action="new-group">New group</button></div>
      </div>
      ${groups.length ? `<ul class="cardlist">${groups.map(groupCard).join('')}</ul>`
        : `<div class="card"><p class="none">No active groups. Start one, or restore one from Archived below.</p></div>`}
      ${archived.length ? `<details class="archived" ${archivedOpen ? 'open' : ''}>
        <summary>${icon.archive}Archived <span class="count">${archived.length}</span></summary>
        <ul class="cardlist">${archived.map(groupCard).join('')}</ul>
      </details>` : ''}
    </section>

    <section class="section">
      <div class="section-head"><h2>Lately</h2>${recent.length ? '<a class="btn small" href="#/activity">See all</a>' : ''}</div>
      <div class="card">${recent.length ? activityList(recent, null, true) : `<p class="none">Nothing yet. Tap + to add the first expense.</p>`}</div>
    </section>
  </div>`;
  app.querySelector('details.archived')?.addEventListener('toggle', ev => { archivedOpen = ev.target.open; });
}
