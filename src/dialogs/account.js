import { sb } from '../supabase.js';
import { myPersonId, PENDING_JOIN_KEY } from '../store.js';
import { esc } from '../lib/format.js';
import { toast } from '../ui.js';
import { personName } from '../selectors.js';
import { setAuthNote } from '../auth.js';
import { form, setDraft, openDialog, closeDialog, fail, describeError } from './dialog.js';

export function openProfile({ welcome = false } = {}){
  setDraft({});
  openDialog(`
    <h2>${welcome ? 'Welcome to settlr' : 'Your name'}</h2>
    ${welcome ? '<p class="hint">What should people call you? We guessed from your email.</p>' : ''}
    <label>Name<input name="name" maxlength="30" value="${esc(personName(myPersonId))}" autocomplete="name"></label>
    <p class="hint">This is how you appear to everyone in your groups.</p>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">${welcome ? 'Skip' : 'Cancel'}</button>
      <button type="submit" class="btn primary">Save</button>
    </div>`, async () => {
      const name = form.name.value.trim();
      if(!name) return fail('Enter your name.', form.name);
      const { error } = await sb.from('people').update({ name }).eq('id', myPersonId);
      if(error) return fail(describeError(error));
      toast('Name updated.');
    });
}
export function openDeleteAccount(){
  setDraft({});
  openDialog(`
    <h2>Delete your account?</h2>
    <p style="margin:0">This permanently deletes your settlr account. Here’s what happens:</p>
    <ul class="bullets">
      <li>Groups where nobody else has signed in are deleted, along with their expenses.</li>
      <li>Groups shared with other signed-in people stay, so their balances remain correct. Your name stays on past expenses there.</li>
      <li>People you added and settlements outside groups are deleted, unless a shared group still needs them.</li>
    </ul>
    <p class="hint">Want a copy first? <button type="button" class="btn small" data-action="export-all">Download my data</button></p>
    <label>Type DELETE to confirm<input name="confirm" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"></label>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn destroy">Delete account</button>
    </div>`, async () => {
      if(form.confirm.value.trim().toUpperCase() !== 'DELETE') return fail('Type DELETE to confirm.', form.confirm);
      const { error } = await sb.rpc('delete_my_account');
      if(error){
        /* PGRST202: the RPC doesn't exist yet — supabase/delete_my_account.sql hasn't been run */
        if(error.code === 'PGRST202'){ console.warn('delete_my_account RPC missing', error); return fail('Account deletion isn’t available yet. Try again later.'); }
        return fail(describeError(error));
      }
      clearLocalData();
      setAuthNote('Your account has been deleted. Thanks for using settlr.');
      closeDialog();
      await sb.auth.signOut({ scope: 'local' });
      return false;
    });
}
function clearLocalData(){
  try{ [PENDING_JOIN_KEY, 'settlr:activeGroup'].forEach(k => localStorage.removeItem(k)); }catch(e){}
}
export async function signOut(){
  const { error } = await sb.auth.signOut();
  if(error) await sb.auth.signOut({ scope: 'local' });
}
