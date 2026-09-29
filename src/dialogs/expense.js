import { sb } from '../supabase.js';
import { state } from '../store.js';
import { $, esc, money, toPence, today, currencySymbol } from '../lib/format.js';
import { distribute } from '../lib/ledger.js';
import { group, personName, defaultPayer, isMe, lastActivity } from '../selectors.js';
import { parseRoute } from '../router.js';
import { toast } from '../ui.js';
import { avatar, groupTile, icon } from '../views/shared.js';
import { form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';
import { openGroup } from './group.js';
import { prepareReceipt, uploadReceipt, removeReceipts, receiptUrl } from '../receipts.js';
import { isPdf, pathIsPdf, sizeLabel } from '../lib/receipt.js';

const touch = () => window.matchMedia?.('(pointer: coarse)').matches;
/* Size the amount box to its digits (a "." is narrow) so the currency sign sits right beside them */
const fitAmount = () => {
  const i = form.amount; if(!i) return;
  const v = i.value || i.placeholder, dots = (v.match(/[.,]/g) || []).length;
  i.style.width = (v.length - dots + dots * 0.35 + 0.15) + 'ch';
};

export function openExpense(eid, prefill){
  const g = group(); const e = eid ? g.expenses.find(x => x.id === eid) : null;
  const def = { equal:{}, exact:{}, shares:{} };
  g.members.forEach(mid => { def.equal[mid] = 1; def.shares[mid] = 1; def.exact[mid] = ''; });
  setDraft({ id: e?.id, mode: e?.splitMode || prefill?.mode || 'equal', ...def,
    receiptPath: e?.receipt || null, receiptFile: null, receiptPreview: null, receiptRemoved: false });
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
  const modes = [['equal','Equally'],['shares','Shares'],['exact','Exact']];
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','del'];
  const who = mid => isMe(mid) ? 'You' : esc(personName(mid));
  openDialog(`
    <h2 class="sr">${e ? 'Edit expense' : 'Add expense'}</h2>
    <div class="sheet-head">
      <span class="grp">${groupTile(g, 'sm')}<span>${e ? 'Edit · ' : ''}${esc(g.name)}</span></span>
      ${e ? '' : `<button type="button" class="iconbtn" data-action="voice-expense" aria-label="Add by voice" title="Add by voice">${icon.mic}</button>`}
      <button type="button" class="iconbtn" data-action="close" aria-label="Close">${icon.close}</button>
    </div>
    <label class="amount"><span class="sr">Amount in ${g.currency}</span><span class="cur" aria-hidden="true">${esc(currencySymbol(g.currency))}</span><input name="amount" inputmode="${touch() ? 'none' : 'decimal'}" autocomplete="off" value="${amountVal}" placeholder="0"></label>
    <label>What for?<input name="desc" maxlength="80" value="${esc(descVal)}" placeholder="Dinner, taxi, tickets…"></label>
    <fieldset class="field"><legend class="flabel">Paid by</legend>
      <div class="chips">${g.members.map(mid => `<label class="chip"><input type="radio" name="paidBy" value="${mid}" ${mid===paidByVal?'checked':''}>${avatar(mid,'sm')}${who(mid)}</label>`).join('')}</div>
    </fieldset>
    <fieldset class="field"><legend class="sr">Split</legend>
      <div class="flabel"><span>Split</span><span class="hint" id="splitHint" aria-live="polite"></span></div>
      <div class="seg small">${modes.map(([v,l]) => `<label><input type="radio" name="mode" value="${v}" ${draft.mode===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
      <div id="splitRows"></div>
    </fieldset>
    <label class="daterow">Date<input type="date" name="date" value="${dateVal}"></label>
    <div class="receipt" id="receiptBox"></div>
    <div class="keypad" aria-hidden="true">${keys.map(k => `<button type="button" tabindex="-1" data-key="${k}">${k === 'del' ? icon.backspace : k}</button>`).join('')}</div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e ? `<button type="button" class="btn danger" data-action="del-entry" data-id="${e.id}">Delete</button><span class="sp"></span><button type="submit" class="btn primary">Save changes</button>`
          : `<button type="submit" class="btn primary wide">Add expense</button>`}
    </div>`, saveExpense);
  fitAmount();
  renderSplitRows();
  renderReceipt();
}
/* From the + button: straight in when there's a group in view (or only one), otherwise ask which */
export function openAddExpense(){
  const r = parseRoute();
  if(r.name === 'group' && group()) return openExpense();
  if(!state.groups.length){ toast('Start a group first, then add expenses to it.'); return openGroup(true); }
  if(state.groups.length === 1){ state.activeGroupId = state.groups[0].id; return openExpense(); }
  setDraft({});
  const groups = state.groups.slice().sort((a, c) => lastActivity(c) - lastActivity(a));
  openDialog(`
    <div class="sheet-head"><h2 style="flex:1">Add to which group?</h2><button type="button" class="iconbtn" data-action="close" aria-label="Close">${icon.close}</button></div>
    <ul class="cardlist">${groups.map(g => `<li><button type="button" class="card gcard" data-action="pick-group" data-id="${g.id}" style="font:inherit;text-align:left;cursor:pointer">
      ${groupTile(g)}<span class="r-main"><span class="r-title serif">${esc(g.name)}</span><span class="r-meta">${g.members.length} people · ${esc(g.currency)}</span></span></button></li>`).join('')}</ul>`, () => false);
}
function renderSplitRows(){
  const g = group(), m = draft.mode, box = $('#splitRows');
  box.className = m === 'equal' ? 'chips' : 'srows';
  box.innerHTML = g.members.map(mid => {
    const name = isMe(mid) ? 'You' : esc(personName(mid));
    if(m==='equal') return `<label class="chip"><input type="checkbox" data-sid="${mid}" ${draft.equal[mid]?'checked':''}>${avatar(mid,'sm')}${name}</label>`;
    if(m==='exact') return `<label class="srow">${avatar(mid,'sm')}<span class="nm">${name}</span><input inputmode="decimal" autocomplete="off" aria-label="${name}'s amount" data-sid="${mid}" value="${esc(draft.exact[mid])}" placeholder="0.00"></label>`;
    return `<label class="srow">${avatar(mid,'sm')}<span class="nm">${name}</span><span class="sval" data-share="${mid}"></span><input type="number" min="0" step="1" inputmode="numeric" aria-label="${name}'s shares" data-sid="${mid}" value="${draft.shares[mid]}"></label>`;
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
    else if(left === 0){ hint.textContent = 'Everything is assigned'; }
    else { hint.textContent = left>0 ? `${money(left,g.currency)} left to assign` : `${money(-left,g.currency)} too much`; hint.classList.add('bad'); }
    return;
  }
  const w = {}; g.members.forEach(mid => w[mid] = draft.mode==='equal' ? (draft.equal[mid]?1:0) : Math.max(0, Number(draft.shares[mid])||0));
  const split = amount>0 ? distribute(amount, w) : null;
  if(split) for(const [id,v] of Object.entries(split)){ const el = form.querySelector(`[data-share="${id}"]`); if(el) el.textContent = money(v,g.currency); }
  const n = Object.values(w).filter(x => x>0).length;
  if(!n){ hint.textContent = draft.mode==='equal' ? 'Pick at least one person' : 'Give at least one person a share'; hint.classList.add('bad'); return; }
  if(draft.mode === 'equal' && split){
    const vals = Object.values(split), lo = Math.min(...vals), hi = Math.max(...vals);
    hint.textContent = `${money(lo,g.currency)}${hi !== lo ? '–' + money(hi,g.currency) : ''} each`;
  } else hint.textContent = draft.mode === 'equal' ? `${n} ${n === 1 ? 'person' : 'people'}` : '';
}
/* The receipt line: an "Add a receipt" button, or a thumbnail of the one attached with Open and Remove */
function renderReceipt(){
  const box = $('#receiptBox'); if(!box) return;
  const d = draft;
  if(d.receiptFile){
    const pdf = isPdf(d.receiptFile.type);
    box.innerHTML = `<span class="rthumb">${pdf ? '<b>PDF</b>' : `<img src="${d.receiptPreview}" alt="">`}</span>
      <span class="r-main"><span class="r-title">Receipt attached</span><span class="r-meta">${pdf ? 'PDF' : 'Photo'} · ${sizeLabel(d.receiptFile.size)} · saved with the expense</span></span>
      <button type="button" class="iconbtn" data-receipt="remove" aria-label="Remove receipt" title="Remove receipt">${icon.trash}</button>`;
    return;
  }
  if(d.receiptPath && !d.receiptRemoved){
    const pdf = pathIsPdf(d.receiptPath);
    box.innerHTML = `<a class="rthumb" target="_blank" rel="noopener" aria-label="Open the receipt">${pdf ? '<b>PDF</b>' : '<img alt="">'}</a>
      <span class="r-main"><span class="r-title">Receipt</span><span class="r-meta" data-receipt-status>Loading…</span></span>
      <button type="button" class="iconbtn" data-receipt="remove" aria-label="Remove receipt" title="Remove receipt">${icon.trash}</button>`;
    const path = d.receiptPath;
    receiptUrl(path).then(url => {
      if(draft !== d || d.receiptRemoved || d.receiptFile) return;
      const a = box.querySelector('.rthumb'), img = a.querySelector('img');
      a.href = url; if(img) img.src = url;
      box.querySelector('[data-receipt-status]').innerHTML = `<a href="${url}" target="_blank" rel="noopener">Open ${pdf ? 'PDF' : 'photo'}</a>`;
    }).catch(() => {
      if(draft !== d) return;
      const st = box.querySelector('[data-receipt-status]'); if(st) st.textContent = 'Couldn’t load it just now';
    });
    return;
  }
  box.innerHTML = `<label class="btn small receipt-add">${icon.clip}<span>${d.receiptPath ? 'Add a new receipt' : 'Add a receipt'}</span><input type="file" name="receipt" accept="image/*,application/pdf" class="sr"></label>`;
}
async function pickReceipt(file){
  const d = draft;
  fail('');
  try{
    const blob = await prepareReceipt(file);
    if(draft !== d) return;
    if(d.receiptPreview) URL.revokeObjectURL(d.receiptPreview);
    d.receiptFile = blob;
    d.receiptPreview = isPdf(blob.type) ? null : URL.createObjectURL(blob);
    renderReceipt();
  }catch(err){ fail(err.message || 'Couldn’t read that file.'); }
}
function removeReceipt(){
  const d = draft;
  if(d.receiptFile){
    if(d.receiptPreview) URL.revokeObjectURL(d.receiptPreview);
    d.receiptFile = null; d.receiptPreview = null;
  } else d.receiptRemoved = true;
  renderReceipt();
}
const receiptError = err => /bucket not found/i.test(err?.message || '')
  ? 'Receipts aren’t switched on yet. Remove the receipt to save without it.'
  : describeError(err);

/* The on-screen keypad (phones): same rules as typing, at most two decimals */
function pressKey(k){
  const i = form.amount; let a = i.value;
  if(k === 'del') a = a.slice(0, -1);
  else if(k === '.'){ if(!a.includes('.')) a = (a || '0') + '.'; }
  else { if(/\.\d\d$/.test(a) || a.replace('.', '').length >= 7) return; a = a === '0' ? k : a + k; }
  i.value = a;
  i.dispatchEvent(new Event('input', { bubbles: true }));
}
export function initExpenseDialog(){
  /* The form is shared by every dialog; only react while the expense split editor is showing */
  const editing = () => draft && form.querySelector('#splitRows');
  form.addEventListener('click', ev => {
    const k = ev.target.closest('[data-key]');
    if(k && editing()) pressKey(k.dataset.key);
    if(ev.target.closest('[data-receipt="remove"]') && editing()) removeReceipt();
  });
  form.addEventListener('change', ev => {
    if(!editing()) return;
    const t = ev.target;
    if(t.name === 'receipt'){ if(t.files?.[0]) pickReceipt(t.files[0]); return; }
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
    if(t.name === 'amount') fitAmount();
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
  /* Upload first so the expense never points at a file that isn't there; tidy up whichever file lost */
  const d = draft, old = d.receiptPath;
  let added = null;
  if(d.receiptFile){
    try{ added = await uploadReceipt(g.id, d.receiptFile); }
    catch(err){ return fail(receiptError(err)); }
    row.receipt_path = added;
  } else if(d.receiptRemoved) row.receipt_path = null;
  const result = await saveExpenseRow(d.id, row, splits);
  if(result === false){ if(added) removeReceipts([added]); return false; }
  if(old && (added || d.receiptRemoved)) removeReceipts([old]);
  if(d.receiptPreview) URL.revokeObjectURL(d.receiptPreview);
  return result;
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
