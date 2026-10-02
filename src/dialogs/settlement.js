import { dateField } from './datepicker.js';
import { sb } from '../supabase.js';
import { state, myPersonId } from '../store.js';
import { esc, toPence, today, currencyOptions, plainAmount } from '../lib/format.js';
import { form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';

export function openSettlement(opts = {}){
  const e = opts.id ? state.payments.find(x => x.id === opts.id) : null;
  const people = state.people.slice().sort((a,b) => a.name.localeCompare(b.name));
  const from = e ? e.from : (opts.from || (people.some(p => p.id === myPersonId) ? myPersonId : people[0]?.id));
  const to = e ? e.to : (opts.to || people.find(p => p.id !== from)?.id);
  const sel = (name, val) => `<select name="${name}">${people.map(p => `<option value="${p.id}" ${p.id===val?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
  setDraft({ id: e?.id });
  openDialog(`
    <h2>${e?'Edit settlement':'Record a settlement'}</h2>
    <div class="two"><label>From${sel('from',from)}</label><label>To${sel('to',to)}</label></div>
    <div class="two">
      <label>Amount<input name="amount" inputmode="decimal" autocomplete="off" value="${e ? plainAmount(e.amount, e.currency) : ''}" placeholder="0.00"></label>
      <label>Currency<select name="currency">${currencyOptions(e?.currency || 'GBP')}</select></label>
    </div>
    <div class="two">
      <div class="datewrap"><span class="flabel">Date</span>${dateField('date', e?.date||today())}</div>
      <label>Note (optional)<input name="note" maxlength="60" value="${esc(e?.note||'')}" placeholder="What was this for?"></label>
    </div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e?`<button type="button" class="btn danger" data-action="del-settlement" data-id="${e.id}">Delete</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${e?'Save changes':'Record settlement'}</button>
    </div>`, async () => {
      const f = form.from.value, t = form.to.value, a = toPence(form.amount.value);
      if(!f || !t || f === t) return fail('Pick two different people.', form.to);
      if(!(a > 0)) return fail('Enter an amount above zero.', form.amount);
      const row = { from_person:f, to_person:t, amount_cents:a, currency: form.currency.value, payment_date: form.date.value || today(), note: form.note.value.trim() || null };
      try{
        if(draft.id){ const { error } = await sb.from('payments').update(row).eq('id', draft.id); if(error) throw error; }
        else { const { error } = await sb.from('payments').insert(row); if(error) throw error; }
      }catch(err){ return fail(describeError(err)); }
    });
}
