import { sb } from '../supabase.js';
import { state, session } from '../store.js';
import { $, esc, CURRENCIES } from '../lib/format.js';
import { group, personName, involved } from '../selectors.js';
import { form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';

export function openGroup(isNew){
  const g = isNew ? null : group();
  setDraft({ editingGroupId: g?.id || null, members: g ? g.members.slice() : [] });
  openDialog(`
    <h2>${isNew?'New group':'Edit group'}</h2>
    <label>Group name<input name="name" maxlength="50" value="${esc(g?.name||'')}" placeholder="Flat 4B, Lisbon weekend"></label>
    <label>Currency<select name="currency">${CURRENCIES.map(c => `<option ${c===(g?.currency||'GBP')?'selected':''}>${c}</option>`).join('')}</select></label>
    ${g?`<p class="hint">Invite code: <b>${esc(g.inviteCode)}</b> <button type="button" class="btn small" data-action="invite">Share invite link</button></p>`:''}
    <fieldset><legend>People in this group</legend><div id="mlist" class="srows"></div></fieldset>
    <div class="mrow"><input name="newMember" maxlength="30" placeholder="Add a saved or new name" aria-label="Person's name"><button type="button" class="btn" data-action="add-member">Add</button></div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${g?`<button type="button" class="btn danger" data-action="del-group">Delete group</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${isNew?'Create group':'Save changes'}</button>
    </div>`, async () => {
      await addPendingMember();
      const name = form.name.value.trim();
      if(!name) return fail('Give the group a name.');
      if(draft.members.length < 2) return fail('Add at least two people.');
      const chosen = draft.members.map(id => personName(id).toLowerCase());
      if(new Set(chosen).size !== chosen.length) return fail('Two of the people you picked share a name. Rename one so the ledger stays clear.');
      try{
        if(g){
          const { error } = await sb.from('groups').update({ name, currency: form.currency.value }).eq('id', g.id);
          if(error) throw error;
          const before = new Set(g.members), after = new Set(draft.members);
          const toAdd = draft.members.filter(id => !before.has(id));
          const toRemove = g.members.filter(id => !after.has(id));
          if(toAdd.length){ const { error:ae } = await sb.from('group_members').insert(toAdd.map(person_id => ({ group_id: g.id, person_id }))); if(ae) throw ae; }
          for(const pid of toRemove){ const { error:re } = await sb.from('group_members').delete().eq('group_id', g.id).eq('person_id', pid); if(re) throw re; }
        } else {
          const { data: gid, error } = await sb.rpc('create_group', { name, currency: form.currency.value, member_person_ids: draft.members });
          if(error) throw error;
          return '#/g/' + encodeURIComponent(gid);
        }
      }catch(err){ return fail(describeError(err)); }
    });
  renderMembers();
}
function renderMembers(){
  const box = $('#mlist');
  const list = state.people.slice().sort((a,b) => a.name.localeCompare(b.name));
  const editingGroup = draft.editingGroupId ? state.groups.find(x => x.id === draft.editingGroupId) : null;
  box.innerHTML = list.length ? list.map(p => {
    const checked = draft.members.includes(p.id);
    const locked = checked && editingGroup && editingGroup.members.includes(p.id) && involved(editingGroup, p.id);
    return `<label class="srow"><input type="checkbox" data-pid="${p.id}" ${checked?'checked':''} ${locked?'disabled':''}><span class="nm">${esc(p.name)}</span>${locked?'<span class="sval">in an expense</span>':''}</label>`;
  }).join('') : `<p class="hint" style="margin:0">Nobody's here yet.</p>`;
}
export async function addPendingMember(){
  const inp = form.newMember; if(!inp) return;
  const n = inp.value.trim(); if(!n) return;
  let p = state.people.find(x => x.name.toLowerCase() === n.toLowerCase());
  if(!p){
    const { data, error } = await sb.from('people').insert({ name: n, owner_id: session.user.id }).select('id,name').single();
    if(error){ const el = form.querySelector('.err'); if(el) el.textContent = error.message; return; }
    p = { id: data.id, name: data.name };
    state.people.push(p);
  }
  if(!draft.members.includes(p.id)) draft.members.push(p.id);
  inp.value = ''; renderMembers(); inp.focus();
}
export function initGroupDialog(){
  form.addEventListener('keydown', async ev => { if(ev.target.name === 'newMember' && ev.key === 'Enter'){ ev.preventDefault(); await addPendingMember(); } });
  form.addEventListener('change', ev => {
    const t = ev.target;
    if(t.dataset.pid && draft){
      if(t.checked){ if(!draft.members.includes(t.dataset.pid)) draft.members.push(t.dataset.pid); }
      else draft.members = draft.members.filter(id => id !== t.dataset.pid);
    }
  });
}
