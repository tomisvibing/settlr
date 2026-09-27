import { sb } from '../supabase.js';
import { $, esc, money, toPence, today } from '../lib/format.js';
import { distribute } from '../lib/ledger.js';
import { group, personName, defaultPayer } from '../selectors.js';
import { form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';

export function openExpense(eid, prefill){
  const g = group(); const e = eid ? g.expenses.find(x => x.id === eid) : null;
  const def = { equal:{}, exact:{}, shares:{} };
  g.members.forEach(mid => { def.equal[mid] = 1; def.shares[mid] = 1; def.exact[mid] = ''; });
  setDraft({ id: e?.id, mode: e?.splitMode || prefill?.mode || 'equal', ...def });
  if(e){
    const inp = e.splitInput || {};
    g.members.forEach(mid => {
      if(e.splitMode==='equal') draft.equal[mid] = inp[mid] ? 1 : 0;
      if(e.splitMode==='shares') draft.shares[mid] = inp[mid] ?? 0;
      if(e.splitMode==='exact') draft.exact[mid] = inp[mid] ? (inp[mid]/100).toFixed(2) : '';
    });
  }
  if(prefill?.subset) g.members.forEach(mid => draft.equal[mid] = prefill.subset.includes(mid) ? 1 : 0);
  const descVal = prefill?.desc ?? e?.desc ?? '';
  const amountVal = prefill?.amount != null ? (prefill.amount/100).toFixed(2) : (e ? (e.amount/100).toFixed(2) : '');
  const dateVal = prefill?.date || e?.date || today();
  const paidByVal = prefill?.paidBy || e?.paidBy || defaultPayer(g);
  const modes = [['equal','Equally'],['exact','Exact amounts'],['shares','Shares']];
  openDialog(`
    <h2>${e?'Edit expense':'Add expense'}</h2>
    <label>What was it for?<input name="desc" maxlength="80" value="${esc(descVal)}" placeholder="e.g. Dinner at Hawksmoor"></label>
    <div class="two">
      <label>Amount (${g.currency})<input name="amount" inputmode="decimal" autocomplete="off" value="${amountVal}" placeholder="0.00"></label>
      <label>Date<input type="date" name="date" value="${dateVal}"></label>
    </div>
    <label>Paid by<select name="paidBy">${g.members.map(mid => `<option value="${mid}" ${mid===paidByVal?'selected':''}>${esc(personName(mid))}</option>`).join('')}</select></label>
    <fieldset><legend>Split</legend><div class="seg">${modes.map(([v,l]) => `<label><input type="radio" name="mode" value="${v}" ${draft.mode===v?'checked':''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <div class="srows" id="splitRows"></div>
    <p class="hint" id="splitHint"></p>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e?`<button type="button" class="btn danger" data-action="del-entry" data-id="${e.id}">Delete</button>`:''}
      <span class="sp"></span>
      <button type="button" class="btn" data-action="close">Cancel</button>
      <button type="submit" class="btn primary">${e?'Save changes':'Add expense'}</button>
    </div>`, saveExpense);
  renderSplitRows();
}
function renderSplitRows(){
  const g = group(), m = draft.mode;
  $('#splitRows').innerHTML = g.members.map(mid => {
    const name = esc(personName(mid));
    if(m==='equal') return `<label class="srow"><input type="checkbox" data-sid="${mid}" ${draft.equal[mid]?'checked':''}><span class="nm">${name}</span><span class="sval" data-share="${mid}"></span></label>`;
    if(m==='exact') return `<label class="srow"><span class="nm">${name}</span><input inputmode="decimal" autocomplete="off" aria-label="${name}'s amount" data-sid="${mid}" value="${esc(draft.exact[mid])}" placeholder="0.00"></label>`;
    return `<label class="srow"><span class="nm">${name}</span><span class="sval" data-share="${mid}"></span><input type="number" min="0" step="1" inputmode="numeric" aria-label="${name}'s shares" data-sid="${mid}" value="${draft.shares[mid]}"></label>`;
  }).join('');
  updateHint();
}
function updateHint(){
  const g = group(), amount = toPence(form.amount.value), hint = $('#splitHint');
  hint.className = 'hint';
  form.querySelectorAll('[data-share]').forEach(s => s.textContent = '');
  if(draft.mode === 'exact'){
    let sum = 0; for(const v of Object.values(draft.exact)) sum += toPence(v) || 0;
    const left = (amount||0) - sum;
    if(!amount){ hint.textContent = `Assigned so far: ${money(sum,g.currency)}`; }
    else if(left === 0){ hint.textContent = 'Everything is assigned.'; }
    else { hint.textContent = left>0 ? `${money(left,g.currency)} left to assign` : `${money(-left,g.currency)} more than the total`; hint.classList.add('bad'); }
    return;
  }
  const w = {}; g.members.forEach(mid => w[mid] = draft.mode==='equal' ? (draft.equal[mid]?1:0) : Math.max(0, Number(draft.shares[mid])||0));
  const split = amount>0 ? distribute(amount, w) : null;
  if(split) for(const [id,v] of Object.entries(split)){ const el = form.querySelector(`[data-share="${id}"]`); if(el) el.textContent = money(v,g.currency); }
  const n = Object.values(w).filter(x => x>0).length;
  hint.textContent = n ? '' : (draft.mode==='equal' ? 'Pick at least one person.' : 'Give at least one person a share.');
  if(!n) hint.classList.add('bad');
}
export function initExpenseDialog(){
  /* The form is shared by every dialog; only react while the expense split editor is showing */
  const editing = () => draft && form.querySelector('#splitRows');
  form.addEventListener('change', ev => {
    if(!editing()) return;
    const t = ev.target;
    if(t.name === 'mode'){ draft.mode = t.value; renderSplitRows(); return; }
    if(t.dataset.sid && t.type === 'checkbox'){ draft.equal[t.dataset.sid] = t.checked ? 1 : 0; updateHint(); }
  });
  form.addEventListener('input', ev => {
    if(!editing()) return;
    const t = ev.target;
    if(t.dataset.sid && t.type !== 'checkbox'){
      const id = t.dataset.sid;
      if(draft.mode==='exact') draft.exact[id] = t.value; else draft.shares[id] = t.value;
    }
    if((t.dataset.sid && t.type !== 'checkbox') || t.name === 'amount') updateHint();
  });
}
async function saveExpense(){
  const g = group();
  const desc = form.desc.value.trim();
  const amount = toPence(form.amount.value);
  if(!desc) return fail('Add a short description, like "Dinner".');
  if(!(amount > 0)) return fail('Enter an amount above zero.');
  let splits, input = {};
  if(draft.mode === 'exact'){
    splits = {}; let sum = 0;
    for(const mid of g.members){
      const p = toPence(draft.exact[mid]);
      if(Number.isNaN(p) || p < 0) return fail(`Check the amount for ${personName(mid)}.`);
      if(p > 0){ splits[mid] = p; input[mid] = p; sum += p; }
    }
    if(sum !== amount) return fail(`The split adds up to ${money(sum,g.currency)}, but the expense is ${money(amount,g.currency)}.`);
  } else {
    g.members.forEach(mid => input[mid] = draft.mode==='equal' ? (draft.equal[mid]?1:0) : Math.max(0, Math.floor(Number(draft.shares[mid])||0)));
    splits = distribute(amount, input);
    if(!splits) return fail(draft.mode==='equal' ? 'Pick at least one person to split with.' : 'Give at least one person a share above zero.');
  }
  const row = { group_id: g.id, type:'expense', description: desc, amount_cents: amount, paid_by: form.paidBy.value, split_mode: draft.mode, expense_date: form.date.value || today(), split_input: input };
  return saveExpenseRow(draft.id, row, splits);
}
export async function saveExpenseRow(expenseId, row, splits){
  try{
    if(expenseId){
      const { error } = await sb.from('expenses').update(row).eq('id', expenseId);
      if(error) throw error;
      const { error: de } = await sb.from('expense_splits').delete().eq('expense_id', expenseId);
      if(de) throw de;
    } else {
      const { data, error } = await sb.from('expenses').insert(row).select('id').single();
      if(error) throw error;
      expenseId = data.id;
    }
    const splitRows = Object.entries(splits).map(([person_id, amount_cents]) => ({ expense_id: expenseId, person_id, amount_cents }));
    if(splitRows.length){
      const { error } = await sb.from('expense_splits').insert(splitRows);
      if(error) throw error;
    }
  }catch(err){ return fail(describeError(err)); }
}
