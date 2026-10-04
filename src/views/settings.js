import { state, session, myPersonId } from '../store.js';
import { $, esc, currencyOptions } from '../lib/format.js';
import { personName, myHandles } from '../selectors.js';
import { PAY_APPS } from '../lib/paylinks.js';
import { getThemeOverride } from '../theme.js';
import { nudgePref } from '../nudge.js';
import { homeCurrency } from '../prefs.js';
import { pushKnown, checkPush, pushSupport } from '../push.js';
import { folder } from './shared.js';

/* A member number that's yours and stays put: six digits from your account id */
function memberNo(id){
  const n = parseInt(String(id).replace(/[^0-9a-f]/gi, '').slice(0, 8) || '0', 16) % 1e6;
  const s = String(n).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}
const since = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''; };

const arrow = '<span aria-hidden="true">→</span>';

/* "Send me notifications on / off." On an iPhone outside the Home Screen app, says how to get them */
function pushPref(){
  const on = pushKnown();
  if(on === null) checkPush().then(() => { if(document.body.dataset.route === 'settings') renderSettings(); });
  const why = { install: 'On an iPhone they work once settlr is on your Home Screen: tap Share, then Add to Home Screen, and switch them on there.', blocked: 'Notifications are blocked for settlr in your browser or phone settings.', unsupported: 'This browser can’t show notifications.' }[pushSupport()];
  return `<li><span id="pushLead">Send me notifications</span>
    <span class="keep"><span class="seg inline" role="radiogroup" aria-labelledby="pushLead">${[['on', true], ['off', false]].map(([l, v]) =>
      `<label><input type="radio" name="push" value="${l}" ${!!on === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>.</span>
    <span class="pref-note">${why || 'A summary of who owes what on Sunday evenings, and a ping when someone nudges you.'}</span></li>`;
}

/* "People can pay me with Monzo and PayPal." or an invitation to add them */
function payPref(){
  const h = myHandles() || {}, apps = PAY_APPS.filter(a => h[a.key]).map(a => a.name);
  const list = apps.length > 1 ? apps.slice(0, -1).join(', ') + ' and ' + apps.at(-1) : apps[0];
  return `<li>${apps.length ? `People can pay me with ${list}.` : 'Let people pay me in a tap.'}
    <button type="button" class="btn small pref-btn" data-action="pay-links">${apps.length ? 'Change' : 'Add Monzo, PayPal or Revolut'}</button></li>`;
}

/* You: your account as a member's card, settings as sentences you finish, then the plain links,
   each in its folder */
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

    ${folder({ id: 'prefs', title: 'Preferences', body: `<ul class="prefs">
      ${payPref()}
      <li><span id="themeLead">Show settlr in</span>
        <span class="seg inline" role="radiogroup" aria-labelledby="themeLead">${[['light', 'day'], ['dark', 'night'], ['system', 'my device’s']].map(([v, l]) =>
          `<label><input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>
        mode.</li>
      <li><label for="homeCur">My home currency is</label>
        <span class="keep"><select id="homeCur" name="homeCurrency">${currencyOptions(homeCurrency())}</select>.</span>
        <span class="pref-note">New expenses and groups start in this. Each group keeps its own currency, and any expense can still be in another.</span></li>
      ${pushPref()}
      <li><span id="nudgeLead">Remind me to nudge people who owe me</span>
        <span class="keep"><span class="seg inline" role="radiogroup" aria-labelledby="nudgeLead">${[['never', 'never'], ['weekly', 'weekly'], ['fortnightly', 'fortnightly'], ['monthly', 'monthly']].map(([v, l]) =>
          `<label><input type="radio" name="nudges" value="${v}" ${nudgePref() === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</span>.</span>
        <span class="pref-note">Once a group’s been quiet that long, Home lists who still owes you. Nothing is sent until you’ve read the message and said yes. Remembered on this device.</span></li>
    </ul>` })}

    ${folder({ id: 'account', title: 'Account', body: `<div class="links">
      <button type="button" data-action="join-group">Join a group with a code ${arrow}</button>
      <button type="button" data-action="edit-profile">Change my name ${arrow}</button>
      <button type="button" data-action="export-all">Download my data ${arrow}</button>
      <button type="button" data-action="sign-out">Sign out ${arrow}</button>
      <button type="button" class="danger" data-action="delete-account">Delete my account ${arrow}</button>
    </div>` })}
    <p class="foot">Deleting your account removes everything only you use. Shared groups stay intact for everyone else.</p>
  </div>`;
}
