import { state, myPersonId } from '../store.js';
import { $, esc, money, ago } from '../lib/format.js';
import { balances } from '../lib/ledger.js';
import { storyParts } from '../lib/story.js';
import { personName, shortName, meIn, lastActivity, isArchived, canAdmin, isMe } from '../selectors.js';
import { groupHref } from '../router.js';
import { avatar, icon, swipeButtons } from './shared.js';
import { dueNow } from '../nudge.js';

/* Whether the Archived list is open, kept across re-renders (live updates redraw the page) */
let archivedOpen = false;

const firstName = pid => (personName(pid) || '').split(' ')[0];

/* Members as a short list: "You, Alex, Priya" or "You, Alex and 4 more" */
function memberLine(g){
  const names = g.members.slice().sort((a, c) => isMe(c) - isMe(a)).map(pid => isMe(pid) ? 'You' : firstName(pid));
  return names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(', ');
}

/* One group as a ticket: the name on the main part, your balance on the stub. Swipe it left for
   Edit, Archive and Delete (or Restore when archived) */
function ticket(g){
  const me = meIn(g), v = me ? (balances(g)[me] || 0) : 0, n = g.members.length;
  const del = canAdmin(g) ? [['del-group', 'Delete', icon.trash, 'del']] : [];
  const acts = isArchived(g)
    ? [['restore-group', 'Restore', icon.restore], ...del]
    : [['edit-group', 'Edit', icon.edit], ['archive-group', 'Archive', icon.archive], ...del];
  const when = isArchived(g) ? `archived ${ago(g.archivedAt)}` : ago(lastActivity(g));
  const [amt, lbl] = !me ? ['—', 'you’re not in it']
    : v > 0 ? [`+${money(v, g.currency)}`, 'owed to you']
    : v < 0 ? [`−${money(-v, g.currency)}`, 'you owe']
    : ['Square', g.expenses.length ? 'nobody owes' : 'nothing yet'];
  return `<li class="swipe"><a class="ticket" href="${groupHref(g)}">
    <span class="t-main">
      <span class="t-kind">${n} ${n === 1 ? 'person' : 'people'} · ${esc(g.currency)}</span>
      <span class="t-name">${esc(g.name)}</span>
      <span class="t-meta">${esc(memberLine(g))} · ${when}</span>
    </span>
    <span class="t-stub"><span class="t-amt${v < 0 ? ' down' : ''}">${amt}</span><span class="t-lbl">${lbl}</span></span>
  </a>${swipeButtons(acts, g.id, g.id)}</li>`;
}

const greeting = (h = new Date().getHours()) => h < 5 ? 'Evening' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
function hello(){
  const name = firstName(myPersonId);
  return `<div class="hello-row">
    <p class="hello">${greeting()}${name ? `, ${esc(name)}` : ''}.</p>
  </div>`;
}

/* Where you stand, in one paragraph: people link to People, what you owe is red */
function story(){
  const parts = storyParts(state.groups, isMe, shortName, money);
  const html = parts.map(p => typeof p === 'string' ? esc(p)
    : p.person ? `<a href="#/people">${esc(p.name)}</a>`
    : `<em class="${p.tone}">${p.amount}</em>`).join('');
  return `<p class="story">${html}</p>`;
}

/* As often as you chose in Settings (never, unless you switch it on), the people who still owe you in groups that have gone
   quiet, each with a Nudge */
function nudges(){
  const due = dueNow(); if(!due.length) return '';
  return `<section class="nudges" aria-labelledby="nudgeHead">
    <h2 id="nudgeHead">Some groups have gone quiet. Want to nudge anyone?</h2>
    <ul>${due.slice(0, 4).map(({ g, pid, amount }) => `<li>
      ${avatar(pid, 'sm')}<span class="n-text"><b>${esc(shortName(pid))}</b> owes you ${money(amount, g.currency)}<span class="n-sub">${esc(g.name)} · quiet since ${ago(lastActivity(g))}</span></span>
      <button class="btn small" data-action="nudge" data-group="${g.id}" data-id="${pid}" data-amount="${amount}">Nudge</button>
    </li>`).join('')}</ul>
    <button type="button" class="n-later" data-action="dismiss-nudges">Not now</button>
  </section>`;
}

/* Expenses typed with "Decide later": still waiting for a group. Private to you */
function toSort(){
  if(!state.drafts.length) return '';
  return `<section class="section" aria-labelledby="sortHead">
    <div class="section-head"><h2 id="sortHead">To sort</h2></div>
    <ul class="moves">${state.drafts.map(d => `<li class="move">
      <span class="m-who"><b>${esc(d.desc)}</b></span>
      <span class="m-amt">${money(d.amount, d.currency)}</span>
      <span class="m-acts"><button class="btn small" data-action="sort-draft" data-id="${d.id}">Pick a group</button>
        <button class="btn small" data-action="del-draft" data-id="${d.id}" data-desc="${esc(d.desc)}">Delete</button></span>
    </li>`).join('')}</ul>
  </section>`;
}

/* Your groups as tickets, then the archived ones folded away. Used on the overview and on Groups */
export function groupList(){
  const byRecent = (a, c) => lastActivity(c) - lastActivity(a);
  const groups = state.groups.filter(g => !isArchived(g)).sort(byRecent);
  const archived = state.groups.filter(isArchived).sort((a, c) => c.archivedAt - a.archivedAt);
  return `<section class="section" aria-labelledby="groupsHead">
      <div class="section-head">
        <h2 id="groupsHead">Your groups</h2>
        <div class="chipbar"><button class="btn small" data-action="join-group">Join</button><button class="btn small" data-action="new-group">New group</button></div>
      </div>
      ${groups.length ? `<ul class="tickets">${groups.map(ticket).join('')}</ul>`
        : `<p class="none">No active groups. Start one, or restore one from Archived below.</p>`}
      ${archived.length ? `<details class="archived" ${archivedOpen ? 'open' : ''}>
        <summary>${icon.archive}Archived <span class="count">${archived.length}</span></summary>
        <ul class="tickets">${archived.map(ticket).join('')}</ul>
      </details>` : ''}
    </section>`;
}
export const bindArchived = root => root.querySelector('details.archived')?.addEventListener('toggle', ev => { archivedOpen = ev.target.open; });

export function renderHome(){
  const app = $('#app');
  if(!state.groups.length){
    app.innerHTML = `<div class="stack">
      ${hello()}
      ${toSort()}
      <section class="empty">
        <h1 class="display">Start a group to split your first bill.</h1>
        <button class="btn primary" data-action="new-group">Start a group</button>
        <button class="btn" data-action="join-group">Join with an invite code</button>
      </section>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="stack">
    ${hello()}
    <h1 class="sr">Overview</h1>
    ${story()}
    ${nudges()}
    ${toSort()}

    ${groupList()}
  </div>`;
  bindArchived(app);
}
