import { state, session, myPersonId } from '../store.js';
import { $, esc } from '../lib/format.js';
import { personName } from '../selectors.js';
import { getThemeOverride } from '../theme.js';

/* A member number that's yours and stays put: six digits from your account id */
function memberNo(id){
  const n = parseInt(String(id).replace(/[^0-9a-f]/gi, '').slice(0, 8) || '0', 16) % 1e6;
  const s = String(n).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}
const since = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''; };

const arrow = '<span aria-hidden="true">→</span>';

/* You: your account as a member's card, settings as sentences you finish, then the plain links */
export function renderSettings(){
  const app = $('#app');
  const u = session.user;
  const name = personName(myPersonId);
  const theme = getThemeOverride() || 'system';
  const groups = state.groups.length;
  const expenses = state.groups.reduce((n, g) => n + g.expenses.filter(e => e.type !== 'payment').length, 0);
  const people = state.people.length;
  const joined = since(u.created_at);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  app.innerHTML = `<div class="stack">
    <h1 class="sr">You</h1>
    <div class="member-card" role="img" aria-label="Membership card: ${esc(name)}${joined ? `, member since ${joined}` : ''}, ${plural(groups, 'group')}, ${plural(expenses, 'expense')}, ${people} ${people === 1 ? 'person' : 'people'}">
      <div class="mc-top"><span class="mc-mark">settlr</span><span class="mc-no">No. ${memberNo(u.id)}</span></div>
      <div class="mc-name">${esc(name)}</div>
      ${joined ? `<div class="mc-since">Member since ${joined}</div>` : ''}
      <div class="mc-stats"><span><b>${groups}</b>${groups === 1 ? 'group' : 'groups'}</span><span><b>${expenses}</b>${expenses === 1 ? 'expense' : 'expenses'}</span><span><b>${people}</b>${people === 1 ? 'person' : 'people'}</span></div>
    </div>
    <p class="signed-in">Signed in as <b>${esc(u.email || 'your Google account')}</b></p>

    <ul class="prefs">
      <li><span id="themeLead">Show settlr in</span>
        <span class="seg inline" role="radiogroup" aria-labelledby="themeLead">${[['light', 'day'], ['dark', 'night'], ['system', 'my phone’s']].map(([v, l]) =>
          `<label><input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>
        mode.</li>
    </ul>

    <div class="links">
      <button type="button" data-action="join-group">Join a group with a code ${arrow}</button>
      <button type="button" data-action="edit-profile">Change my name ${arrow}</button>
      <button type="button" data-action="export-all">Download my data ${arrow}</button>
      <button type="button" data-action="sign-out">Sign out ${arrow}</button>
      <button type="button" class="danger" data-action="delete-account">Delete my account ${arrow}</button>
    </div>
    <p class="foot">Deleting your account removes everything only you use. Shared groups stay intact for everyone else.</p>
  </div>`;
}
