/* Your payment links: the usernames people who owe you can pay to, with the amount filled in */
import { sb } from '../supabase.js';
import { state, session } from '../store.js';
import { esc } from '../lib/format.js';
import { PAY_APPS, cleanHandle } from '../lib/paylinks.js';
import { toast } from '../ui.js';
import { form, setDraft, openDialog, fail, describeError } from './dialog.js';

const NOTES = { monzo: 'Used for amounts in pounds.', paypal: 'Any currency PayPal supports.', revolut: 'Revolut opens your page; they type the amount.' };

export function openPayLinks(){
  setDraft({});
  const mine = state.payHandles[session.user.id] || {};
  openDialog(`
    <h2>Get paid in a tap</h2>
    <p class="hint">When someone owes you, settlr shows them a button that opens their app with the amount filled in. Leave any you don’t use empty.</p>
    ${PAY_APPS.map(a => `<label>${a.name}
      <span class="prefixed"><span aria-hidden="true">${a.host}/</span><input name="${a.key}" value="${esc(mine[a.key] || '')}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="${a.key}Note" placeholder="username"></span>
      <span class="hint" id="${a.key}Note">${NOTES[a.key]}</span></label>`).join('')}
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">Save</button>
    </div>`, async () => {
      const row = { user_id: session.user.id, updated_at: new Date().toISOString() };
      for(const a of PAY_APPS){
        const v = cleanHandle(form[a.key].value, a.host);
        if(v === null) return fail(`That doesn’t look like a ${a.name} username. It’s the part after ${a.host}/.`, form[a.key]);
        row[a.key] = v || null;
      }
      const { error } = await sb.from('pay_handles').upsert(row);
      if(error) return fail(describeError(error));
      toast('Payment links saved.');
    });
}
