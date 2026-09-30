import { sb } from '../supabase.js';
import { state } from '../store.js';
import { esc } from '../lib/format.js';
import { toast } from '../ui.js';
import { form, setDraft, openDialog, fail, describeError } from './dialog.js';
import { syncMyPhoto } from '../photo.js';

export function openJoinGroup(prefill){
  setDraft({});
  openDialog(`
    <h2>Join a group</h2>
    <label>Invite code<input name="code" maxlength="12" value="${esc(prefill || '')}" placeholder="e.g. 8f3a2c1d" autocapitalize="off" autocorrect="off"></label>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">Continue</button>
    </div>`, async () => {
      const code = form.code.value.trim().toLowerCase();
      if(!code) return fail('Enter the invite code.', form.code);
      const existing = state.groups.find(x => x.inviteCode === code);
      if(existing){ toast(`You’re already in ${existing.name}.`); return '#/g/' + encodeURIComponent(existing.id); }
      const { data, error } = await sb.rpc('preview_group_by_code', { code });
      if(error) return fail(describeError(error, 'join'), form.code);
      if(data && data.length){ openClaimPicker(code, data); return false; }
      const { data: gid, error: je } = await sb.rpc('join_group_by_code', { code });
      if(je) return fail(describeError(je, 'join'), form.code);
      syncMyPhoto();
      return '#/g/' + encodeURIComponent(gid);
    });
  if(prefill) form.requestSubmit();
}
function openClaimPicker(code, candidates){
  setDraft({});
  openDialog(`
    <h2>Is that you?</h2>
    <p class="hint">This group already has people who haven’t signed in yet. If one of them is you, pick your name so your past expenses stay attached to you.</p>
    <fieldset><div class="srows">
      ${candidates.map(c => `<label class="srow"><input type="radio" name="claim" value="${c.person_id}"><span class="nm">${esc(c.name)}</span></label>`).join('')}
      <label class="srow"><input type="radio" name="claim" value="" checked><span class="nm">None of these — I’m new</span></label>
    </div></fieldset>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">Join</button>
    </div>`, async () => {
      const claimId = form.claim.value || null;
      const { data: gid, error } = await sb.rpc('join_group_by_code', { code, claim_person_id: claimId });
      if(error) return fail(describeError(error, 'join'));
      syncMyPhoto();
      return '#/g/' + encodeURIComponent(gid);
    });
}
