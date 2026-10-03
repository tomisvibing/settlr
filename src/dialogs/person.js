import { sb } from '../supabase.js';
import { state, session } from '../store.js';
import { esc } from '../lib/format.js';
import { avatar } from '../views/shared.js';
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

/* Everyone you've saved, to rename or delete. People rows on the People page are read-only, so this is
   where that happens */
export function openManagePeople(){
  setDraft({});
  const people = state.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  const note = p => isMe(p.id) ? 'You' : personLocked(p.id) ? 'In a group or settlement' : 'Not in any group, so can be deleted';
  openDialog(`
    <h2>Edit people</h2>
    <p class="hint">Tap someone to rename them, or to delete them if they’re not in any group or settlement.</p>
    ${people.length ? `<ul class="standings" aria-label="People">${people.map(p => `<li><button type="button" class="st-row" data-action="edit-person" data-id="${p.id}">${avatar(p.id)}<span class="st-text"><span class="st-line">${esc(p.name)}</span><span class="st-sub">${note(p)}</span></span></button></li>`).join('')}</ul>`
      : '<p class="hint">No one saved yet.</p>'}
    <div class="dlg-actions"><span class="sp"></span><button type="button" class="btn" data-action="close">Done</button></div>`, () => false);
}
