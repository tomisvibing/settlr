import { state } from '../store.js';
import { $, esc, byNewest } from '../lib/format.js';
import { lastActivity } from '../selectors.js';
import { receipt, activityGroup, filterActivity, resetActivityFilter } from './receipt.js';

/* Every expense and payment across all groups, printed as one long receipt. Filter by group along
   the top; search when there's enough to search */
export function renderActivity(){
  const entries = state.groups.flatMap(g => g.expenses.map(e => ({ e, g }))).sort((x, y) => byNewest(x.e, y.e));
  const withSpend = state.groups.filter(g => g.expenses.length).sort((a, c) => lastActivity(c) - lastActivity(a));
  let only = activityGroup();
  /* A filter for a group that's gone, or with no chips left to undo it, is dropped */
  if(only && (withSpend.length < 2 || !withSpend.some(g => g.id === only))){ resetActivityFilter(); only = null; }
  $('#app').innerHTML = `<div class="stack">
    <header class="page-head"><h1 class="display">Activity</h1></header>
    ${withSpend.length > 1 ? `<div class="filters" role="group" aria-label="Show">
      <button type="button" data-action="act-filter" aria-pressed="${!only}">Everything</button>
      ${withSpend.map(g => `<button type="button" data-action="act-filter" data-id="${g.id}" aria-pressed="${only === g.id}">${esc(g.name)}</button>`).join('')}
    </div>` : ''}
    ${entries.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search by what, who or group" aria-label="Search activity" autocomplete="off">` : ''}
    ${entries.length ? receipt(entries, { withGroup: true, foot: 'Thank you for splitting.' })
      : `<div class="none"><p>No expenses yet. Everything you and your groups add shows up here.</p><button class="btn small" data-action="quick-add">Add an expense</button></div>`}
  </div>`;
  /* A group filter picked earlier still applies after a live update redraws the page */
  if(only) filterActivity('');
}
