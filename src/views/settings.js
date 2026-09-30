import { session, myPersonId } from '../store.js';
import { $, esc } from '../lib/format.js';
import { personName } from '../selectors.js';
import { getThemeOverride } from '../theme.js';
import { avatar } from './shared.js';

export function renderSettings(){
  const app = $('#app');
  const u = session.user;
  const name = personName(myPersonId);
  const theme = getThemeOverride() || 'system';
  app.innerHTML = `<div class="stack">
    <div class="ghead" style="padding-top:8px"><div><h1>You</h1><p>Your account, settings and data.</p></div></div>

    <section class="card" aria-label="Account">
      <div class="profile">
        ${avatar(myPersonId, 'lg')}
        <span class="who"><b>${esc(name)}</b><span>${esc(u.email || 'Signed in with Google')}</span></span>
        <button class="btn small" data-action="edit-profile">Edit name</button>
      </div>
      <div class="setrow" style="border-top:1px solid var(--line-soft)"><p>Join a group<small>Got an invite code? Enter it here.</small></p><button class="btn small" data-action="join-group">Join</button></div>
      <div class="setrow"><p>Sign out<small>You can sign back in any time with Google.</small></p><button class="btn small" data-action="sign-out">Sign out</button></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Appearance</h2></div>
      <div class="seg" role="radiogroup" aria-label="Theme">${[['system','Match device'],['light','Light'],['dark','Dark']].map(([v,l]) =>
        `<label><input type="radio" name="theme" value="${v}" ${theme===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Your data</h2></div>
      <div class="card"><div class="setrow"><p>Download my data<small>Every group, expense, person and settlement you can see, as a JSON file.</small></p><button class="btn small" data-action="export-all">Download</button></div></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Danger zone</h2></div>
      <div class="danger-zone">
        <p><b>Delete account</b></p>
        <p class="hint">Permanently delete your settlr account and everything only you use. Shared groups stay intact for everyone else. This can’t be undone.</p>
        <button class="btn outline-neg" data-action="delete-account">Delete my account</button>
      </div>
    </section>

    <p class="foot">settlr · Split shared expenses without the maths.</p>
  </div>`;
}
