/* A new expense as one sentence you edit: "You paid £42.50 for dinner, split equally between you,
   Alex and Priya, in Lisbon weekend." Each underlined part opens its own tray underneath. Equal
   splits save from here; shares, exact amounts, dates, receipts and other currencies go on to the
   full sheet, filled in */
import { state } from '../store.js';
import { $, esc, money, toPence, today, currencySymbol, minorDigits, minorStep } from '../lib/format.js';
import { distribute } from '../lib/ledger.js';
import { group, personName, shortName, isMe, meIn, lastActivity, activeGroups } from '../selectors.js';
import { parseRoute } from '../router.js';
import { toast } from '../ui.js';
import { icon } from '../views/shared.js';
import { form, draft, setDraft, openDialog, fail } from './dialog.js';
import { openExpense, saveExpenseRow, keypad } from './expense.js';
import { openGroup } from './group.js';
import { homeCurrency } from '../prefs.js';

const MODES = { equal: 'equally', shares: 'by shares', exact: 'by exact amounts' };
const touch = () => window.matchMedia?.('(pointer: coarse)').matches;
const byRecent = (a, c) => lastActivity(c) - lastActivity(a);
const who = pid => isMe(pid) ? 'you' : shortName(pid);
/* "you and Alex", "everyone" when it's the whole group, "you, Alex and 3 others" when it's long */
function list(ids, g){
  if(g && ids.length > 2 && ids.length === g.members.length) return 'everyone';
  const ns = ids.slice().sort((a, c) => isMe(c) - isMe(a)).map(who);
  if(ns.length > 3) return `${ns.slice(0, 2).join(', ')} and ${ns.length - 2} others`;
  return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns.at(-1) : ns[0] || 'nobody';
}

/* Start a sentence: in this group if you're on its page, otherwise "in a group" until you pick one */
export function openComposer(start = {}){
  const r = parseRoute(), here = r.name === 'group' ? group() : null;
  const gid = start.gid ?? (here && !here.archivedAt ? here.id : null);
  const g = state.groups.find(x => x.id === gid);
  setDraft({
    compose: true, gid,
    payer: start.payer && g?.members.includes(start.payer) ? start.payer : (g ? (meIn(g) || g.members[0]) : null),
    amount: start.amount ?? '', what: start.what ?? '', mode: start.mode ?? 'equal',
    who: g ? (start.who?.filter(id => g.members.includes(id)).length ? start.who.filter(id => g.members.includes(id)) : g.members.slice()) : [],
    /* Every expense is shared with someone, so with no group yet that's the first question */
    open: start.open ?? (!g ? 'group' : start.amount ? null : 'amount'),
  });
  openDialog(`
    <div class="sheet-head"><h2 class="sheet-title">New expense</h2><button type="button" class="iconbtn" data-action="close" aria-label="Close">${icon.close}</button></div>
    <p class="sentence" id="sentence"></p>
    <p class="each" id="each" aria-live="polite"></p>
    <div class="tray" id="tray"></div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions"><button type="button" class="btn" data-compose="more">More details</button><span class="sp"></span><button type="submit" class="btn primary" id="composeGo">Add it</button></div>`, save, { top: true });
  render();
  /* Opening on the amount: on a phone the keypad is already up; with a keyboard, type straight away */
  if(draft.open === 'amount' && !touch()) form.querySelector('#cAmount')?.focus();
}

/* A group's own currency once it's picked; until then, yours */
const cur = () => state.groups.find(x => x.id === draft.gid)?.currency || homeCurrency();
/* Each changeable part is a span acting as a button, so a long one wraps like the words around it */
const tok = (key, text, label) => `<span class="tok" role="button" tabindex="0" data-tok="${key}" aria-expanded="${draft.open === key}" aria-controls="tray" aria-label="${esc(label)}: ${esc(text)}. Change">${esc(text)}</span>`;

function render(){ renderSentence(); renderTray(); }
function renderSentence(){
  const d = draft, g = state.groups.find(x => x.id === d.gid);
  const payer = !d.payer || isMe(d.payer) ? 'You' : shortName(d.payer);
  $('#sentence').innerHTML = `${tok('payer', payer, 'Who paid')} paid ${tok('amount', currencySymbol(cur()) + (d.amount || '0'), 'How much')} for ${tok('what', d.what || 'something', 'What for')}, split ${tok('mode', MODES[d.mode], 'How it’s split')} between ${tok('who', g ? list(d.who, g) : 'everyone', 'Who it’s for')}, in ${tok('group', g ? g.name : 'a group', 'Which group')}.`;
  $('#composeGo').textContent = d.mode === 'equal' ? 'Add it' : 'Set the amounts';
  const amount = toPence(d.amount), each = $('#each');
  if(!g){ each.textContent = 'Pick the group to see who it’s split with.'; return; }
  if( !(amount > 0) || !d.who.length || d.mode !== 'equal'){ each.textContent = d.mode !== 'equal' && g ? 'You’ll set each person’s part next.' : ''; return; }
  const split = distribute(amount, Object.fromEntries(d.who.map(id => [id, 1])), minorStep(cur()));
  const vals = Object.values(split), lo = Math.min(...vals), hi = Math.max(...vals);
  const me = meIn(g), mine = split[me] || 0;
  const tail = me === d.payer ? (amount - mine ? `, so you’re owed <b>${money(amount - mine, cur())}</b>` : '')
    : mine ? `, so you owe ${esc(shortName(d.payer))} <b>${money(mine, cur())}</b>` : '';
  each.innerHTML = `That’s <b>${money(lo, cur())}</b>${hi !== lo ? `–<b>${money(hi, cur())}</b>` : ''} each${tail}.`;
}
function renderTray(){
  const d = draft, tray = $('#tray'), k = d.open, g = state.groups.find(x => x.id === d.gid);
  const people = g ? g.members : [];
  const person = (id, on) => `<button type="button" class="opt" aria-pressed="${on}" data-v="${id}"><span class="av sm" aria-hidden="true">${esc((personName(id)[0] || '?').toUpperCase())}</span>${isMe(id) ? 'You' : esc(personName(id))}</button>`;
  const text = (v, label, on) => `<button type="button" class="opt text" aria-pressed="${on}" data-v="${v}">${esc(label)}</button>`;
  if(!k){ tray.innerHTML = `<p class="tray-label">Tap the underlined words to change them</p>`; return; }
  if(k === 'payer') tray.innerHTML = `<p class="tray-label" id="trayLabel">Who paid?</p><div class="opts" role="group" aria-labelledby="trayLabel">${people.map(id => person(id, d.payer === id)).join('') || '<span class="hint">Pick a group first.</span>'}</div>`;
  if(k === 'who') tray.innerHTML = `<p class="tray-label" id="trayLabel">Who’s it for?</p><div class="opts" role="group" aria-labelledby="trayLabel">${people.map(id => person(id, d.who.includes(id))).join('') || '<span class="hint">Pick a group first.</span>'}</div>`;
  if(k === 'mode') tray.innerHTML = `<p class="tray-label" id="trayLabel">How’s it split?</p><div class="opts" role="group" aria-labelledby="trayLabel">${Object.entries(MODES).map(([v, l]) => text(v, l[0].toUpperCase() + l.slice(1), d.mode === v)).join('')}</div>`;
  if(k === 'group'){
    const open = activeGroups().slice().sort(byRecent);
    tray.innerHTML = `<p class="tray-label" id="trayLabel">For which group?</p><div class="opts" role="group" aria-labelledby="trayLabel">${open.map(x => text(x.id, x.name, d.gid === x.id)).join('')}<button type="button" class="opt text" data-v="new">${icon.plus}New group</button></div>`;
  }
  if(k === 'what') tray.innerHTML = `<label class="tray-label" for="cWhat">What was it for?</label><input id="cWhat" maxlength="80" value="${esc(d.what)}" placeholder="Dinner, taxi, tickets…" autocomplete="off" enterkeyhint="done">`;
  if(k === 'amount') tray.innerHTML = `<label class="tray-label" for="cAmount">How much? <span class="hint">in ${esc(cur())}</span></label>
    <input id="cAmount" class="c-amount" inputmode="${touch() ? 'none' : minorDigits(cur()) === 0 ? 'numeric' : 'decimal'}" autocomplete="off" value="${esc(d.amount)}" placeholder="0">${keypad(cur())}`;
}

/* Keypad presses: the same rules as the full sheet, at most two decimals */
function press(k){
  let a = draft.amount;
  const maxWhole = minorDigits(cur()) ? 7 : 10;
  if(k === 'del') a = a.slice(0, -1);
  else if(k === '.'){ if(!a.includes('.')) a = (a || '0') + '.'; }
  else if(a.includes('.')){ if(/\.\d\d$/.test(a)) return; a += k; }
  else if(a === '' || a === '0') a = k.replace(/^0+/, '') || '0';
  else { if(a.length + k.length > maxWhole) return; a += k; }
  draft.amount = a;
  const i = $('#cAmount'); if(i) i.value = a;
  const said = $('#amountSaid'); if(said) said.textContent = `Amount ${a || '0'}`;
  renderSentence();
}

/* Hand over to the full sheet, filled in, for anything this sentence doesn't cover */
function moreDetails(){
  const d = draft;
  if(!d.gid) return askGroup();
  state.activeGroupId = d.gid;
  openExpense(null, { desc: d.what, amount: toPence(d.amount) > 0 ? toPence(d.amount) : null, currency: cur(), paidBy: d.payer, subset: d.who, mode: d.mode });
}
/* Nothing is saved until the person says which group: open that part of the sentence */
function askGroup(){
  draft.open = 'group'; render(); fail('Pick which group this is for.'); $('[data-tok="group"]')?.focus();
  return false;
}
/* A brand-new group ("New group" in the tray): start one, then come back to this sentence in it */
function startGroup(){
  const keep = { amount: draft.amount, what: draft.what, mode: draft.mode, open: null };
  const amount = toPence(keep.amount);
  openGroup(true, {
    carry: { desc: keep.what, amount: amount > 0 ? amount : 0, currency: cur(), resume: gid => openComposer({ ...keep, gid }) },
    note: `Start a group for ${keep.what ? esc(keep.what) : 'this expense'}. Add the people you’re splitting it with, then you’re back here.`,
  });
}

async function save(){
  const d = draft, g = state.groups.find(x => x.id === d.gid);
  if(!g) return askGroup();
  if(d.mode !== 'equal'){ moreDetails(); return false; }
  const amount = toPence(d.amount), what = d.what.trim();
  const ask = (open, msg) => { d.open = open; render(); fail(msg); $(`[data-tok="${open}"]`)?.focus(); return false; };
  if(!(amount > 0)) return ask('amount', 'Enter an amount above zero.');
  if(!what) return ask('what', 'Add a short description, like “Dinner”.');
  if(!d.who.length) return ask('who', 'Pick at least one person to split with.');
  const weights = Object.fromEntries(d.who.map(id => [id, 1]));
  const splits = distribute(amount, weights, minorStep(g.currency));
  const row = { group_id: g.id, type: 'expense', description: what, amount_cents: amount, paid_by: d.payer, split_mode: 'equal', expense_date: today(), split_input: weights,
    orig_currency: null, orig_amount_cents: null, fx_rate: null };
  const result = await saveExpenseRow(null, row, splits);
  if(result === false) return false;
  toast(`Added “${what}” to ${g.name}.`);
}

export function initComposer(){
  const on = () => draft?.compose;
  form.addEventListener('click', ev => {
    if(!on()) return;
    const t = ev.target.closest('[data-tok]');
    if(t){
      /* Who paid, who it's for and how it's split all depend on the group, so ask for that first */
      const want = !draft.gid && t.dataset.tok !== 'amount' && t.dataset.tok !== 'what' ? 'group' : t.dataset.tok;
      draft.open = draft.open === want ? null : want;
      render(); fail('');
      $(`[data-tok="${t.dataset.tok}"]`)?.focus();
      if(draft.open === 'what') $('#cWhat')?.focus();
      if(draft.open === 'amount' && !touch()) $('#cAmount')?.focus();
      return;
    }
    if(ev.target.closest('[data-compose="more"]')) return moreDetails();
    const key = ev.target.closest('[data-key]');
    if(key) return press(key.dataset.key);
    const o = ev.target.closest('#tray .opt'); if(!o) return;
    const v = o.dataset.v, k = draft.open;
    if(k === 'payer') draft.payer = v;
    if(k === 'who') draft.who = draft.who.includes(v) ? draft.who.filter(x => x !== v) : state.groups.find(x => x.id === draft.gid).members.filter(x => x === v || draft.who.includes(x));
    if(k === 'mode') draft.mode = v;
    if(k === 'group'){
      if(v === 'new') return startGroup();
      const g = state.groups.find(x => x.id === v), first = !draft.gid;
      draft.gid = v; draft.who = g.members.slice();
      if(!g.members.includes(draft.payer)) draft.payer = meIn(g) || g.members[0];
      /* The group was the first question; the amount is the next */
      if(first && !draft.amount) draft.open = 'amount';
    }
    render(); fail('');
    $(`#tray [data-v="${CSS.escape(v)}"]`)?.focus();
    if(draft.open === 'amount' && !touch()) $('#cAmount')?.focus();
  });
  form.addEventListener('input', ev => {
    if(!on()) return;
    if(ev.target.id === 'cWhat'){ draft.what = ev.target.value; renderSentence(); }
    if(ev.target.id === 'cAmount'){ draft.amount = ev.target.value.replace(/[^0-9.]/g, ''); renderSentence(); }
  });
  /* Enter in a tray field closes the tray rather than submitting half a sentence; Enter or Space on
     a part of the sentence opens its tray, as a button would */
  form.addEventListener('keydown', ev => {
    if(on() && (ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-tok]')){ ev.preventDefault(); ev.target.click(); return; }
    if(!on() || ev.key !== 'Enter' || !ev.target.closest('#tray input')) return;
    ev.preventDefault(); const k = draft.open; draft.open = null; render(); $(`[data-tok="${k}"]`)?.focus();
  });
}
