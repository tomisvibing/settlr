import { sb } from '../supabase.js';
import { state, session } from '../store.js';
import { esc } from '../lib/format.js';
import { isMe, personLocked } from '../selectors.js';
import { form, setDraft, openDialog, fail, describeError } from './dialog.js';

export function openPerson(pid){
  const p = pid ? state.people.find(x => x.id === pid) : null;
  setDraft({});
  const mine = p && isMe(p.id);
  const locked = p && (personLocked(p.id) || mine);
  openDialog(`
    <h2>${p?'Edit person':'Add a person'}</h2>
    <label>Name<input name="name" maxlength="30" value="${esc(p?.name||'')}" placeholder="Full name"></label>
    ${mine?`<p class="hint">This is you — it’s the name other people see in shared groups.</p>`:''}
    ${locked && !mine?`<p class="hint">To delete them, remove them from every group and settlement first.</p>`:''}
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${p?`<button type="button" class="btn danger" data-action="del-person" data-id="${p.id}" ${locked?'disabled':''}>Delete</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${p?'Save changes':'Add person'}</button>
    </div>`, async () => {
      const name = form.name.value.trim();
      if(!name) return fail('Give them a name.', form.name);
      try{
        if(p){ const { error } = await sb.from('people').update({ name }).eq('id', p.id); if(error) throw error; }
        else { const { error } = await sb.from('people').insert({ name, owner_id: session.user.id }); if(error) throw error; }
      }catch(err){ return fail(describeError(err)); }
    });
}
