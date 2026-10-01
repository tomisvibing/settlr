import { sb } from '../supabase.js';
import { state, session } from '../store.js';
import { $, esc, money, currencyOptions } from '../lib/format.js';
import { group, personName, involved, isMe, meIn, canAdmin, isAdmin, hasAccount, isArchived } from '../selectors.js';
import { form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';
import { refresh } from '../data.js';

/* carry: an expense typed before it had a group (see openAddExpense). Once the group exists, that
   expense's sheet opens in it, filled in, instead of the group's page */
export function openGroup(isNew, { carry = null, note = '' } = {}){
  const g = isNew ? null : group();
  setDraft({ editingGroupId: g?.id || null, members: g ? g.members.slice() : [] });
  openDialog(`
    <h2>${isNew?'New group':'Edit group'}</h2>
    ${note || carry ? `<p class="hint">${note || `A new group for ${esc(carry.desc)} · ${money(carry.amount, carry.currency)}. Add the people you’re splitting it with.`}</p>` : ''}
    <label>Group name<input name="name" maxlength="50" value="${esc(g?.name||'')}" placeholder="Flat 4B, Lisbon weekend"></label>
    <label>Currency<select name="currency" ${g?.expenses.length ? 'disabled' : ''}>${currencyOptions(g?.currency || carry?.currency || 'GBP')}</select>${g?.expenses.length ? '<span class="hint" style="font-weight:400">Fixed now the group has expenses. Each expense can still be in any currency.</span>' : ''}</label>
    ${g?`<p class="hint">Invite code: <b>${esc(g.inviteCode)}</b> <button type="button" class="btn small" data-action="invite">Share invite link</button></p>`:''}
    <fieldset><legend>People in this group</legend><div id="mlist" class="srows"></div></fieldset>
    <div class="mrow"><label>Add someone<input name="newMember" maxlength="30" placeholder="A saved or new name" autocomplete="off"></label><button type="button" class="btn" data-action="add-member">Add</button></div>
    <p class="err" role="alert"></p>
    ${g ? `<div class="grp-exit">
      ${isArchived(g) ? `<button type="button" class="btn" data-action="restore-group">Restore group</button>` : `<button type="button" class="btn" data-action="archive-group">Archive group</button>`}
      ${meIn(g) ? `<button type="button" class="btn danger" data-action="leave-group">Leave group</button>` : ''}
      ${canAdmin(g) ? `<button type="button" class="btn danger" data-action="del-group">Delete group</button>` : ''}
    </div>` : ''}
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${carry ? 'Create and continue' : isNew ? 'Create group' : 'Save changes'}</button>
    </div>`, async () => {
      await addPendingMember();
      const name = form.name.value.trim();
      if(!name) return fail('Give the group a name.', form.name);
      if(draft.members.length < 2) return fail('Add at least two people.', form.newMember);
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
          /* Started from a new expense: go back to it, now in this group */
          if(carry?.resume){ await refresh(); state.activeGroupId = gid; carry.resume(gid); return false; }
          return '#/g/' + encodeURIComponent(gid);
        }
      }catch(err){ return fail(describeError(err)); }
    });
  renderMembers();
}
/* Why a ticked person can't be unticked, or '' if they can */
function lockReason(g, pid){
  if(!g || !g.members.includes(pid)) return '';
  if(involved(g, pid)) return 'in an expense';
  if(isMe(pid)) return 'you';
  if(hasAccount(pid) && !canAdmin(g)) return 'admins can remove';
  return '';
}
export function renderMembers(){
  const box = $('#mlist'); if(!box) return;
  const list = state.people.slice().sort((a,b) => a.name.localeCompare(b.name));
  const editingGroup = draft.editingGroupId ? state.groups.find(x => x.id === draft.editingGroupId) : null;
  box.innerHTML = list.length ? list.map(p => {
    const g = editingGroup;
    /* Someone who left comes back through an invite link, not from here */
    if(g?.left.includes(p.id) && !draft.members.includes(p.id)) return `<div class="srow"><label class="srow-pick"><input type="checkbox" disabled aria-describedby="why-${p.id}"><span class="nm">${esc(p.name)}</span></label><span class="sval" id="why-${p.id}">left the group</span></div>`;
    const checked = draft.members.includes(p.id);
    const why = checked ? lockReason(g, p.id) : '';
    const inGroup = g?.members.includes(p.id);
    const admin = inGroup && isAdmin(g, p.id);
    /* Admins can hand the role to anyone in the group with an account */
    const roleCtl = inGroup && hasAccount(p.id) && canAdmin(g)
      ? `<button type="button" class="btn small ${admin ? 'on' : ''}" data-action="toggle-admin" data-pid="${p.id}" aria-pressed="${admin}" title="${admin ? 'Admin. Tap to remove' : 'Let them run the group'}">${admin ? 'Admin' : 'Make admin'}</button>`
      : admin ? '<span class="tag">Admin</span>' : '';
    const shown = why && why !== 'you';
    return `<div class="srow"><label class="srow-pick"><input type="checkbox" data-pid="${p.id}" ${checked?'checked':''} ${why?'disabled':''}${shown ? ` aria-describedby="why-${p.id}"` : ''}><span class="nm">${esc(p.name)}${isMe(p.id) ? ' <span class="you">(you)</span>' : ''}</span></label>${shown ? `<span class="sval" id="why-${p.id}">${why}</span>` : ''}${roleCtl}</div>`;
  }).join('') : `<p class="hint" style="margin:0">No one saved yet. Add people below.</p>`;
}
export async function addPendingMember(){
  const inp = form.newMember; if(!inp) return;
  const n = inp.value.trim(); if(!n) return;
  let p = state.people.find(x => x.name.toLowerCase() === n.toLowerCase());
  if(!p){
    const { data, error } = await sb.from('people').insert({ name: n, owner_id: session.user.id }).select('id,name').single();
    if(error){ fail(describeError(error, 'add them'), inp); return; }
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
