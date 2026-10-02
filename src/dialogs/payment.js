import { dateField } from './datepicker.js';
import { $, esc, toPence, today, plainAmount, currencyOptions, money } from '../lib/format.js';
import { convert, parseRate, formatRate, canFetch } from '../lib/fx.js';
import { fetchRate } from '../rates.js';
import { group, personName, defaultPayer, rosterFor } from '../selectors.js';
import { setJustPaid } from '../store.js';
import { form, draft, setDraft, openDialog, fail } from './dialog.js';
import { saveExpenseRow } from './expense.js';

export function openPayment(opts = {}){
  const g = group(); const e = opts.id ? g.expenses.find(x => x.id === opts.id) : null;
  const from = e ? e.paidBy : (opts.from || defaultPayer(g));
  const to = e ? Object.keys(e.splits)[0] : (opts.to || g.members.find(mid => mid !== from));
  /* Paid in another currency? Same idea as expenses: converted into the group's at a fixed rate */
  const cur = e?.origCurrency || g.currency;
  const amt = e ? (e.origAmount ?? e.amount) : (opts.amount || '');
  const roster = rosterFor(g, e);
  const sel = (name, val) => `<select name="${name}">${roster.map(mid => `<option value="${mid}" ${mid===val?'selected':''}>${esc(personName(mid))}</option>`).join('')}</select>`;
  setDraft({ id: e?.id, cur, rate: e?.fxRate || null, rateManual: !!e?.fxRate });
  openDialog(`
    <h2>${e?'Edit payment':'Record a payment'}</h2>
    <div class="two"><label>From${sel('from',from)}</label><label>To${sel('to',to)}</label></div>
    <div class="two">
      <label>Amount<span class="amtcur"><input name="amount" inputmode="decimal" autocomplete="off" value="${amt ? plainAmount(amt, cur) : ''}" placeholder="0.00"><select name="pcur" aria-label="Currency">${currencyOptions(cur)}</select></span></label>
      <div class="datewrap"><span class="flabel">Date</span>${dateField('date', e?.date||today())}</div>
    </div>
    <div class="fxrow" id="payFx" hidden>
      <label>1 <span data-fx="from"></span> =<input name="rate" inputmode="decimal" autocomplete="off" aria-label="Exchange rate"></label><span>${esc(g.currency)}</span>
      <span class="fxnote" id="payFxNote" aria-live="polite"></span>
    </div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e?`<button type="button" class="btn danger" data-action="del-entry" data-id="${e.id}">Delete</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${e?'Save changes':'Record payment'}</button>
    </div>`, async () => {
      const f = form.from.value, t = form.to.value, typed = toPence(form.amount.value), isForeign = draft.cur !== g.currency;
      if(f === t) return fail('Pick two different people.', form.to);
      if(!(typed > 0)) return fail('Enter an amount above zero.', form.amount);
      if(isForeign && !(draft.rate > 0)) return fail(`Add the exchange rate: how many ${g.currency} one ${draft.cur} buys.`, form.rate);
      const a = isForeign ? convert(typed, draft.rate, g.currency) : typed;
      const row = { group_id: g.id, type:'payment', description:'Payment', amount_cents:a, paid_by:f, split_mode:'payment', expense_date: form.date.value || today(), split_input: {},
        orig_currency: isForeign ? draft.cur : null, orig_amount_cents: isForeign ? typed : null, fx_rate: isForeign ? draft.rate : null };
      const result = await saveExpenseRow(draft.id, row, { [t]: a });
      /* From "Mark paid": the group page stamps this payment Paid when it redraws */
      if(result !== false && opts.settle) setJustPaid({ gid: g.id, from: f, to: t, amount: a });
      return result;
    });
  const d = draft;
  const showFx = note => {
    const row = $('#payFx'); if(!row || draft !== d) return;
    const isForeign = d.cur !== g.currency;
    row.hidden = !isForeign;
    row.querySelector('[data-fx="from"]').textContent = d.cur;
    if(document.activeElement !== form.rate) form.rate.value = d.rate ? formatRate(d.rate) : '';
    const conv = isForeign && d.rate > 0 && toPence(form.amount.value) > 0 ? ` = ${money(convert(toPence(form.amount.value), d.rate, g.currency), g.currency)}` : '';
    $('#payFxNote').textContent = (note ?? d.note ?? '') + conv;
    if(note !== undefined) d.note = note;
  };
  const load = async () => {
    if(d.cur === g.currency || d.rateManual) return showFx();
    if(!canFetch(d.cur, g.currency)){ d.rate = null; return showFx(`Type the rate: there’s no automatic rate for ${d.cur}.`); }
    showFx('Getting the rate…');
    const from = d.cur, r = await fetchRate(from, g.currency, form.date?.value || today());
    if(draft !== d || d.cur !== from || d.rateManual) return;
    d.rate = r?.rate || null;
    showFx(r ? 'European Central Bank rate. Change it to match your bank.' : 'Couldn’t get a rate just now. Type one in.');
  };
  form.pcur.addEventListener('change', () => { d.cur = form.pcur.value; d.rate = null; d.rateManual = false; load(); });
  form.date.addEventListener('change', () => { if(!d.rateManual) load(); });
  form.rate.addEventListener('input', () => { d.rate = parseRate(form.rate.value) || null; d.rateManual = true; showFx('Your rate'); });
  form.amount.addEventListener('input', () => showFx());
  if(d.rateManual) showFx('The rate saved with this payment'); else load();
}
