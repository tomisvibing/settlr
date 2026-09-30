import { state } from '../store.js';
import { $, byNewest } from '../lib/format.js';
import { activityList } from './group.js';

/* Every expense and payment across all groups, newest first */
export function renderActivity(){
  const entries = state.groups.flatMap(g => g.expenses.map(e => ({ e, g }))).sort((x, y) => byNewest(x.e, y.e));
  $('#app').innerHTML = `<div class="stack">
    <div class="ghead" style="padding-top:8px"><div><h1>Activity</h1><p>Everything across your groups.</p></div></div>
    ${entries.length > 6 ? `<input class="search" type="search" data-filter="activity" placeholder="Search by what, who or group" aria-label="Search activity" autocomplete="off">` : ''}
    <div class="card">${entries.length ? activityList(entries, null, true) : `<div class="none"><p>No expenses yet. Everything you and your groups add shows up here.</p><button class="btn small" data-action="quick-add">Add expense</button></div>`}</div>
  </div>`;
}
