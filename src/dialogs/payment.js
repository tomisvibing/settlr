import { esc, toPence, today } from '../lib/format.js';
import { group, personName, defaultPayer } from '../selectors.js';
import { form, draft, setDraft, openDialog, fail } from './dialog.js';
import { saveExpenseRow } from './expense.js';

export function openPayment(opts = {}){
  const g = group(); const e = opts.id ? g.expenses.find(x => x.id === opts.id) : null;
  const from = e ? e.paidBy : (opts.from || defaultPayer(g));
  const to = e ? Object.keys(e.splits)[0] : (opts.to || g.members.find(mid => mid !== from));
  const amt = e ? e.amount : (opts.amount || '');
  const sel = (name, val) => `<select name="${name}">${g.members.map(mid => `<option value="${mid}" ${mid===val?'selected':''}>${esc(personName(mid))}</option>`).join('')}</select>`;
  setDraft({ id: e?.id });
  openDialog(`
    <h2>${e?'Edit payment':'Record a payment'}</h2>
    <div class="two"><label>From${sel('from',from)}</label><label>To${sel('to',to)}</label></div>
    <div class="two">
      <label>Amount (${g.currency})<input name="amount" inputmode="decimal" autocomplete="off" value="${amt?(amt/100).toFixed(2):''}" placeholder="0.00"></label>
      <label>Date<input type="date" name="date" value="${e?.date||today()}"></label>
    </div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e?`<button type="button" class="btn danger" data-action="del-entry" data-id="${e.id}">Delete</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${e?'Save changes':'Record payment'}</button>
    </div>`, async () => {
      const f = form.from.value, t = form.to.value, a = toPence(form.amount.value);
      if(f === t) return fail('Pick two different people.');
      if(!(a > 0)) return fail('Enter an amount above zero.');
      const row = { group_id: g.id, type:'payment', description:'Payment', amount_cents:a, paid_by:f, split_mode:'payment', expense_date: form.date.value || today(), split_input: {} };
      return saveExpenseRow(draft.id, row, { [t]: a });
    });
}
