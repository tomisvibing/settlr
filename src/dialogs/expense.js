import { CATEGORIES } from '../lib/categories.js';
import { sb } from '../supabase.js';
import { session } from '../store.js';
import { $, esc, ago, money, toPence, today, currencySymbol, currencyOptions, plainAmount, minorDigits, minorStep } from '../lib/format.js';
import { convert, parseRate, formatRate, canFetch } from '../lib/fx.js';
import { fetchRate } from '../rates.js';
import { distribute } from '../lib/ledger.js';
import { group, personName, defaultPayer, isMe, rosterFor, isArchived } from '../selectors.js';
import { parseRoute } from '../router.js';
import { toast } from '../ui.js';
import { avatar, groupTile, icon } from '../views/shared.js';
import { dlg, form, draft, setDraft, openDialog, fail, describeError } from './dialog.js';
import { refresh } from '../data.js';
import { openComposer } from './compose.js';
import { askConfirm } from './confirm.js';
import { prepareReceipt, uploadReceipt, removeReceipts, receiptUrl } from '../receipts.js';
import { isPdf, pathIsPdf, sizeLabel } from '../lib/receipt.js';
import { FREQUENCIES, firstRepeat, frequencyLabel } from '../lib/recurring.js';

const touch = () => window.matchMedia?.('(pointer: coarse)').matches;
/* Names for the keypad keys a screen reader would otherwise read as punctuation or nothing */
const keyLabel = k => k === 'del' ? ' aria-label="Delete last digit"' : k === '.' ? ' aria-label="Decimal point"' : k === '00' ? ' aria-label="Double zero"' : '';
/* No pence in yen, won, forint…: the point key becomes 00 */
export const keypad = cur => {
  const keys = ['1','2','3','4','5','6','7','8','9', minorDigits(cur) === 0 ? '00' : '.','0','del'];
  return `<div class="keypad" role="group" aria-label="Amount keypad">${keys.map(k => `<button type="button" data-key="${k}"${keyLabel(k)}>${k === 'del' ? icon.backspace : k}</button>`).join('')}</div>
    <p class="sr" id="amountSaid" role="status"></p>`;
};
/* The amount line: the currency symbol is a picker, then the digits */
const amountLine = (cur, value) => `<div class="amount">
      <label class="curpick" title="Change currency"><span class="cur" id="curSym">${esc(currencySymbol(cur))}</span><select name="cur" aria-label="Currency">${currencyOptions(cur)}</select></label>
      <input name="amount" aria-label="Amount" inputmode="${touch() ? 'none' : minorDigits(cur) === 0 ? 'numeric' : 'decimal'}" autocomplete="off" value="${value}" placeholder="0">
    </div>`;
/* Size the amount box to its digits (a "." is narrow) so the currency sign sits right beside them */
const fitAmount = () => {
  const i = form.amount; if(!i) return;
  const v = i.value || i.placeholder, dots = (v.match(/[.,]/g) || []).length;
  i.style.width = (v.length - dots + dots * 0.35 + 0.15) + 'ch';
};

/* The last currency used in each group, so a week of Swiss receipts doesn't mean a week of switching */
const LAST_CUR_KEY = gid => 'settlr:cur:' + gid;
const lastCur = g => { try{ return localStorage.getItem(LAST_CUR_KEY(g.id)); }catch{ return null; } };
const rememberCur = (g, cur) => { try{ localStorage.setItem(LAST_CUR_KEY(g.id), cur); }catch{ /* private mode */ } };

export function openExpense(eid, prefill){
  const g = group(); const e = eid ? g.expenses.find(x => x.id === eid) : null;
  /* The currency it was spent in: the entry's own, what voice heard, the last one used here, or the group's */
  const cur = e ? (e.origCurrency || g.currency) : (prefill?.currency || lastCur(g) || g.currency);
  const def = { equal:{}, exact:{}, shares:{} };
  /* Who can pay or share: the members, plus anyone on this entry who has since left the group */
  const roster = rosterFor(g, e);
  roster.forEach(mid => { def.equal[mid] = 1; def.shares[mid] = 1; def.exact[mid] = ''; });
  setDraft({ id: e?.id, mode: e?.splitMode || prefill?.mode || 'equal', ...def, roster,
    comments: e ? e.comments.slice() : [],
    cur, rate: e?.fxRate || null, rateManual: !!e?.fxRate, rateNote: e?.fxRate ? 'The rate saved with this expense' : '',
    receiptPath: e?.receipt || null, receiptFile: null, receiptPreview: null, receiptRemoved: false });
  if(e){
    const inp = e.splitInput || {};
    roster.forEach(mid => {
      if(e.splitMode==='equal') draft.equal[mid] = inp[mid] ? 1 : 0;
      if(e.splitMode==='shares') draft.shares[mid] = inp[mid] ?? 0;
      if(e.splitMode==='exact') draft.exact[mid] = inp[mid] ? plainAmount(inp[mid], cur) : '';
    });
  }
  if(prefill?.subset) roster.forEach(mid => draft.equal[mid] = prefill.subset.includes(mid) ? 1 : 0);
  const descVal = prefill?.desc ?? e?.desc ?? '';
  const amountVal = prefill?.amount != null ? plainAmount(prefill.amount, cur) : (e ? plainAmount(e.origAmount ?? e.amount, cur) : '');
  const dateVal = prefill?.date || e?.date || today();
  const paidByVal = prefill?.paidBy || e?.paidBy || defaultPayer(g);
  const modes = [['equal','Equally'],['shares','Shares'],['exact','Exact']];
  const who = mid => isMe(mid) ? 'You' : esc(personName(mid));
  openDialog(`
    <h2 class="sr">${e ? 'Edit expense' : 'Add expense'}</h2>
    <div class="sheet-head">
      <span class="grp">${groupTile(g, 'sm')}<span>${e ? 'Edit · ' : ''}${esc(g.name)}</span></span>
      ${e ? '' : `<button type="button" class="iconbtn" data-action="voice-expense" aria-label="Add by voice" title="Add by voice">${icon.mic}</button>`}
      <button type="button" class="iconbtn" data-action="close" aria-label="Close">${icon.close}</button>
    </div>
    ${prefill?.heard ? `<p class="heard">Heard: “${esc(prefill.heard)}”. Check the details below.</p>` : ''}
    ${amountLine(cur, amountVal)}
    <div class="fxrow" id="fxRow" hidden>
      <label>1 <span data-fx="from"></span> =<input name="rate" inputmode="decimal" autocomplete="off" aria-label="Exchange rate"></label><span data-fx="to">${esc(g.currency)}</span>
      <span class="fxnote" id="fxNote" aria-live="polite"></span>
    </div>
    <label>What for?<input name="desc" maxlength="80" value="${esc(descVal)}" placeholder="Dinner, taxi, tickets…"></label>
    <label>Category<select name="category"><option value="">None</option>${CATEGORIES.map(c => `<option value="${c.key}" ${c.key === (e?.category || '') ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
    <fieldset class="field"><legend class="flabel">Paid by</legend>
      <div class="chips">${roster.map(mid => `<label class="chip"><input type="radio" name="paidBy" value="${mid}" ${mid===paidByVal?'checked':''}>${avatar(mid,'sm')}${who(mid)}</label>`).join('')}</div>
    </fieldset>
    <fieldset class="field"><legend class="sr">Split</legend>
      <div class="flabel"><span>Split</span><span class="hint" id="splitHint" aria-live="polite"></span></div>
      <div class="seg small">${modes.map(([v,l]) => `<label><input type="radio" name="mode" value="${v}" ${draft.mode===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
      <div id="splitRows"></div>
    </fieldset>
    <label class="daterow">Date<input type="date" name="date" value="${dateVal}"></label>
    ${e ? '' : `<label class="daterow">Repeats<select name="repeat"><option value="">Doesn’t repeat</option>${FREQUENCIES.map(([v, l]) => `<option value="${v}">${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></label>
    <p class="hint" id="repeatHint" hidden></p>`}
    <div class="receipt" id="receiptBox"></div>
    ${keypad(cur)}
    ${e ? '<section class="comments" id="commentsBox" aria-label="Comments"></section>' : ''}
    <p class="err" role="alert"></p>
    <div class="dlg-actions">
      ${e ? `<button type="button" class="btn danger" data-action="del-entry" data-id="${e.id}">Delete</button><span class="sp"></span><button type="submit" class="btn primary">Save changes</button>`
          : `<button type="submit" class="btn primary wide">Add expense</button>`}
    </div>`, saveExpense);
  fitAmount();
  renderFx();
  renderSplitRows();
  renderReceipt();
  renderComments();
  if(cur !== g.currency && !draft.rate) loadRate();
}

/* Under Repeats: when the next one will be added */
function showRepeat(){
  const hint = $('#repeatHint'), f = form.repeat?.value; if(!hint) return;
  hint.hidden = !f;
  if(f) hint.textContent = `Next one is added on ${new Date(firstRepeat(form.date.value || today(), f) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${frequencyLabel(f)}.`;
}

/* ---- Comments (on saved expenses) ---- */
function renderComments(){
  const box = $('#commentsBox'); if(!box) return;
  const list = draft.comments;
  box.innerHTML = `<h3>Comments${list.length ? ` · ${list.length}` : ''}</h3>
    ${list.length ? `<ul>${list.map(c => {
      const mine = c.authorUser === session?.user?.id;
      const name = mine ? 'You' : c.authorPerson ? personName(c.authorPerson) : 'Someone';
      return `<li class="comment">${avatar(c.authorPerson || c.id, 'sm')}<div class="c-main">
        <div class="c-who">${esc(name)} · ${ago(c.createdAt)}</div><p class="c-body">${esc(c.body)}</p>
        ${mine ? `<button type="button" class="c-del" data-comment-del="${c.id}">Delete</button>` : ''}</div></li>`;
    }).join('')}</ul>` : ''}
    <div class="composer"><input name="comment" maxlength="1000" placeholder="Add a comment" aria-label="Add a comment" autocomplete="off" enterkeyhint="send"><button type="button" class="btn small" data-comment-post>Post</button></div>`;
}
/* The page behind shows comment counts: reload it once the sheet closes */
const refreshOnClose = () => { if(!draft.commentsTouched){ draft.commentsTouched = true; dlg.addEventListener('close', () => refresh(), { once: true }); } };
async function postComment(){
  const input = form.comment, body = input?.value.trim(); if(!body) return;
  const d = draft; input.disabled = true;
  const { data, error } = await sb.from('expense_comments').insert({ expense_id: d.id, body }).select('*').single();
  if(draft !== d) return;
  if(error){ input.disabled = false; return fail(describeError(error)); }
  d.comments.push({ id: data.id, body: data.body, authorUser: data.author_user, authorPerson: data.author_person, createdAt: new Date(data.created_at).getTime() });
  refreshOnClose(); renderComments(); form.comment?.focus();
}
async function deleteComment(id){
  const d = draft;
  if(!await askConfirm({ title: 'Delete this comment?', body: 'Everyone in the group stops seeing it.', confirmLabel: 'Delete comment' }) || draft !== d) return;
  const { error } = await sb.from('expense_comments').delete().eq('id', id);
  if(draft !== d) return;
  if(error) return fail(describeError(error));
  d.comments = d.comments.filter(c => c.id !== id);
  refreshOnClose(); renderComments();
}

/* ---- Spending in another currency ---- */
const foreign = () => draft.cur !== group().currency;
/* The entry's amount in the group's currency: what balances and splits use */
function groupAmount(){
  const g = group(), typed = toPence(form.amount.value);
  return foreign() ? convert(typed, draft.rate, g.currency) : typed;
}
/* Show or hide the rate line, and match the symbol and keypad to the currency */
function renderFx(){
  const row = $('#fxRow'); if(!row) return;
  syncAmountLine();
  row.hidden = !foreign();
  row.querySelector('[data-fx="from"]').textContent = draft.cur;
  if(document.activeElement !== form.rate) form.rate.value = draft.rate ? formatRate(draft.rate) : '';
  $('#fxNote').textContent = draft.rateNote;
}
/* Match the symbol, the keypad's point key and the keyboard to the currency */
function syncAmountLine(){
  $('#curSym').textContent = currencySymbol(draft.cur);
  const whole = minorDigits(draft.cur) === 0, point = form.querySelector('.keypad [data-key="."], .keypad [data-key="00"]');
  if(point){ point.dataset.key = whole ? '00' : '.'; point.textContent = whole ? '00' : '.'; point.setAttribute('aria-label', whole ? 'Double zero' : 'Decimal point'); }
  if(!touch()) form.amount.inputMode = whole ? 'numeric' : 'decimal';
  fitAmount();
}
/* Fetch the day's rate unless the person typed their own */
async function loadRate(){
  const g = group(), d = draft, from = d.cur;
  if(!foreign() || d.rateManual) return;
  if(!canFetch(from, g.currency)){
    d.rate = null; d.rateNote = `Type the rate: there’s no automatic rate for ${from}.`;
    renderFx(); updateHint(); return;
  }
  d.rateNote = 'Getting the rate…'; renderFx();
  const r = await fetchRate(from, g.currency, form.date?.value || today());
  if(draft !== d || d.cur !== from || d.rateManual) return;
  if(r){ d.rate = r.rate; d.rateNote = `European Central Bank rate for ${new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Change it to match your bank.`; }
  else { d.rate = null; d.rateNote = 'Couldn’t get a rate just now. Type one in.'; }
  renderFx(); updateHint();
}
/* From any + or Add expense: a new expense starts as a sentence (dialogs/compose.js). An archived
   group's own page refuses */
export function openAddExpense(){
  const r = parseRoute();
  if(r.name === 'group' && group() && isArchived(group())) return toast(`${group().name} is archived. Restore it to add expenses.`);
  openComposer();
}
function renderSplitRows(){
  const m = draft.mode, box = $('#splitRows');
  box.className = m === 'equal' ? 'chips' : 'srows';
  box.innerHTML = draft.roster.map(mid => {
    const name = isMe(mid) ? 'You' : esc(personName(mid));
    if(m==='equal') return `<label class="chip"><input type="checkbox" data-sid="${mid}" ${draft.equal[mid]?'checked':''}>${avatar(mid,'sm')}${name}</label>`;
    if(m==='exact') return `<label class="srow">${avatar(mid,'sm')}<span class="nm">${name}</span><input inputmode="decimal" autocomplete="off" aria-label="Amount for ${name}" data-sid="${mid}" value="${esc(draft.exact[mid])}" placeholder="0.00"></label>`;
    return `<label class="srow">${avatar(mid,'sm')}<span class="nm">${name}</span><span class="sval" data-share="${mid}"></span><input type="number" min="0" step="1" inputmode="numeric" aria-label="Shares for ${name}" data-sid="${mid}" value="${draft.shares[mid]}"></label>`;
  }).join('');
  updateHint();
}
function updateHint(){
  const g = group(), amount = groupAmount(), hint = $('#splitHint');
  hint.className = 'hint';
  form.querySelectorAll('[data-share]').forEach(s => s.textContent = '');
  /* Exact amounts are typed in the currency it was spent in */
  if(draft.mode === 'exact'){
    const typed = toPence(form.amount.value), cur = draft.cur;
    let sum = 0; for(const v of Object.values(draft.exact)) sum += toPence(v) || 0;
    const left = (typed||0) - sum;
    if(!typed){ hint.textContent = `Assigned so far: ${money(sum,cur)}`; }
    else if(left === 0){ hint.textContent = 'Everything is assigned'; }
    else { hint.textContent = left>0 ? `${money(left,cur)} left to assign` : `${money(-left,cur)} too much`; hint.classList.add('bad'); }
    return;
  }
  if(foreign() && toPence(form.amount.value) > 0 && !(draft.rate > 0)){ hint.textContent = 'Add the rate to see the split'; return; }
  const w = {}; draft.roster.forEach(mid => w[mid] = draft.mode==='equal' ? (draft.equal[mid]?1:0) : Math.max(0, Number(draft.shares[mid])||0));
  const split = amount>0 ? distribute(amount, w, minorStep(g.currency)) : null;
  if(split) for(const [id,v] of Object.entries(split)){ const el = form.querySelector(`[data-share="${id}"]`); if(el) el.textContent = money(v,g.currency); }
  const n = Object.values(w).filter(x => x>0).length;
  if(!n){ hint.textContent = draft.mode==='equal' ? 'Pick at least one person' : 'Give at least one person a share'; hint.classList.add('bad'); return; }
  if(draft.mode === 'equal' && split){
    const vals = Object.values(split), lo = Math.min(...vals), hi = Math.max(...vals);
    hint.textContent = `${foreign() ? money(amount, g.currency) + ' · ' : ''}${money(lo,g.currency)}${hi !== lo ? '–' + money(hi,g.currency) : ''} each`;
  } else hint.textContent = foreign() && amount > 0 ? `${money(amount, g.currency)} in all` : draft.mode === 'equal' ? `${n} ${n === 1 ? 'person' : 'people'}` : '';
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
  /* Up to 9,999,999.99, or 9,999,999,999 in a currency without pence */
  const maxWhole = minorDigits(draft.cur) ? 7 : 10;
  if(k === 'del') a = a.slice(0, -1);
  else if(k === '.'){ if(!a.includes('.')) a = (a || '0') + '.'; }
  else if(a.includes('.')){ if(/\.\d\d$/.test(a)) return; a += k; }
  else if(a === '' || a === '0') a = k.replace(/^0+/, '') || '0';
  else { if(a.length + k.length > maxWhole) return; a += k; }
  i.value = a;
  i.dispatchEvent(new Event('input', { bubbles: true }));
  const said = $('#amountSaid'); if(said) said.textContent = `Amount ${a || '0'}`;
}
export function initExpenseDialog(){
  /* Enter in the comment box posts the comment, not the whole expense */
  form.addEventListener('keydown', ev => {
    if(ev.key === 'Enter' && ev.target.name === 'comment'){ ev.preventDefault(); postComment(); }
  });
  /* The form is shared by every dialog; only react while the expense split editor is showing */
  const editing = () => draft && form.querySelector('#splitRows');
  form.addEventListener('click', ev => {
    const k = ev.target.closest('[data-key]');
    if(k && editing()) pressKey(k.dataset.key);
    if(ev.target.closest('[data-receipt="remove"]') && editing()) removeReceipt();
    if(ev.target.closest('[data-comment-post]') && editing()) postComment();
    const del = ev.target.closest('[data-comment-del]');
    if(del && editing()) deleteComment(del.dataset.commentDel);
  });
  form.addEventListener('change', ev => {
    if(!editing()) return;
    const t = ev.target;
    if(t.name === 'receipt'){ if(t.files?.[0]) pickReceipt(t.files[0]); return; }
    if(t.name === 'cur'){
      draft.cur = t.value; draft.rate = null; draft.rateManual = false; draft.rateNote = '';
      rememberCur(group(), t.value);
      renderFx(); renderSplitRows(); loadRate(); return;
    }
    if(t.name === 'repeat' || t.name === 'date') showRepeat();
    if(t.name === 'date'){ if(foreign() && !draft.rateManual) loadRate(); return; }
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
    if(t.name === 'rate'){ draft.rate = parseRate(t.value) || null; draft.rateManual = true; draft.rateNote = 'Your rate'; $('#fxNote').textContent = draft.rateNote; }
    if((t.dataset.sid && t.type !== 'checkbox') || t.name === 'amount' || t.name === 'rate') updateHint();
  });
}
async function saveExpense(){
  const g = group();
  const desc = form.desc.value.trim();
  /* typed: in the currency it was spent in; amount: in the group's currency, which balances use */
  const typed = toPence(form.amount.value), isForeign = foreign(), step = minorStep(g.currency);
  if(!desc) return fail('Add a short description, like “Dinner”.', form.desc);
  if(!(typed > 0)) return fail('Enter an amount above zero.', form.amount);
  if(isForeign && !(draft.rate > 0)) return fail(`Add the exchange rate: how many ${g.currency} one ${draft.cur} buys.`, form.rate);
  const amount = isForeign ? convert(typed, draft.rate, g.currency) : typed;
  let splits, input = {};
  if(draft.mode === 'exact'){
    let sum = 0;
    for(const mid of draft.roster){
      const p = toPence(draft.exact[mid]);
      if(Number.isNaN(p) || p < 0) return fail(`Check the amount for ${personName(mid)}.`, form.querySelector(`#splitRows [data-sid="${mid}"]`));
      if(p > 0){ input[mid] = p; sum += p; }
    }
    if(sum !== typed) return fail(`The split adds up to ${money(sum,draft.cur)}, but the expense is ${money(typed,draft.cur)}.`, form.querySelector('#splitRows input'));
    /* Converted shares that still add up exactly to the converted total */
    splits = isForeign ? distribute(amount, input, step) : { ...input };
  } else {
    draft.roster.forEach(mid => input[mid] = draft.mode==='equal' ? (draft.equal[mid]?1:0) : Math.max(0, Math.floor(Number(draft.shares[mid])||0)));
    splits = distribute(amount, input, step);
    if(!splits) return fail(draft.mode==='equal' ? 'Pick at least one person to split with.' : 'Give at least one person a share above zero.', form.querySelector('#splitRows input'));
  }
  const row = { group_id: g.id, type:'expense', description: desc, amount_cents: amount, paid_by: form.paidBy.value, split_mode: draft.mode, expense_date: form.date.value || today(), split_input: input, category: form.category.value || null,
    orig_currency: isForeign ? draft.cur : null, orig_amount_cents: isForeign ? typed : null, fx_rate: isForeign ? draft.rate : null };
  /* Upload first so the expense never points at a file that isn't there; tidy up whichever file lost */
  const d = draft, old = d.receiptPath;
  let added = null;
  if(d.receiptFile){
    try{ added = await uploadReceipt(g.id, d.receiptFile); }
    catch(err){ return fail(receiptError(err)); }
    row.receipt_path = added;
  } else if(d.receiptRemoved) row.receipt_path = null;
  const repeat = d.id ? '' : form.repeat?.value;
  if(repeat && isForeign){ if(added) removeReceipts([added]); return fail(`Repeating expenses are in ${g.currency}. Switch the currency back, or choose Doesn’t repeat.`, form.repeat); }
  const result = await saveExpenseRow(d.id, row, splits);
  if(result === false){ if(added) removeReceipts([added]); return false; }
  if(repeat) await scheduleRepeat(g, row, input, splits, repeat);
  if(old && (added || d.receiptRemoved)) removeReceipts([old]);
  if(d.receiptPreview) URL.revokeObjectURL(d.receiptPreview);
  if(!d.id && !repeat) toast(`Added “${desc}” to ${g.name}.`);
  return result;
}
/* The expense is already saved, so a failure here is a message, not a reason to keep the sheet open */
async function scheduleRepeat(g, row, input, splits, frequency){
  const { error } = await sb.from('recurring_expenses').insert({
    group_id: g.id, description: row.description, amount_cents: row.amount_cents, paid_by: row.paid_by, split_mode: row.split_mode,
    split_input: input, splits, frequency, start_date: firstRepeat(row.expense_date, frequency) });
  if(error) return toast('Added the expense, but couldn’t make it repeat. ' + describeError(error), { error: true });
  /* A first repeat that's already due (an old date) is added now */
  await sb.rpc('run_recurring_expenses');
  toast(`Added “${row.description}”. It repeats ${frequencyLabel(frequency)}.`);
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
