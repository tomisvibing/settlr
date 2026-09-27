import { session, myPersonId } from '../store.js';
import { $, esc, initial } from '../lib/format.js';
import { personName } from '../selectors.js';
import { getThemeOverride } from '../theme.js';

export function renderSettings(){
  const app = $('#app');
  const u = session.user, meta = u.user_metadata || {};
  const name = personName(myPersonId);
  const avatar = meta.avatar_url || meta.picture;
  const theme = getThemeOverride() || 'system';
  app.innerHTML = `
    <section class="hero"><h1>Settings</h1></section>

    <section class="block">
      <h2>Account</h2>
      <div class="profile">
        <span class="avatar">${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</span>
        <span class="who"><b>${esc(name)}</b><span>${esc(u.email || 'Signed in with Google')}</span></span>
        <button class="btn small" data-action="edit-profile">Edit name</button>
      </div>
      <div class="setrow" style="border-top:0"><p>Sign out<small>You can sign back in any time with Google.</small></p><button class="btn small" data-action="sign-out">Sign out</button></div>
    </section>

    <section class="block">
      <h2>Appearance</h2>
      <div class="seg" role="radiogroup" aria-label="Theme">${[['system','Match device'],['light','Light'],['dark','Dark']].map(([v,l]) =>
        `<label><input type="radio" name="theme" value="${v}" ${theme===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
    </section>

    <section class="block">
      <h2>Your data</h2>
      <div class="setrow"><p>Download my data<small>Every group, expense, person and settlement you can see, as a JSON file.</small></p><button class="btn small" data-action="export-all">Download</button></div>
    </section>

    <section class="block">
      <h2>Danger zone</h2>
      <div class="danger-zone">
        <p><b>Delete account</b></p>
        <p class="hint">Permanently delete your settlr account and everything only you use. Shared groups stay intact for everyone else. This can't be undone.</p>
        <button class="btn outline-neg" data-action="delete-account">Delete my account</button>
      </div>
    </section>

    <p class="foot">settlr · Split shared expenses without the maths.</p>`;
}
