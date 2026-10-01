/* One shared <dialog>: each dialog renders its form HTML into it and supplies a submit handler */
import { $ } from '../lib/format.js';
import { refresh } from '../data.js';
import { navigate } from '../router.js';
import { reportError } from '../monitoring.js';
import { friendlyError } from '../lib/errors.js';
import { rememberTrigger, sheetClosed } from '../ui.js';

export const dlg = $('#dlg'), form = $('#dlgForm');
let onSubmit = null;
/* Per-dialog working state (e.g. the split being edited); reset when the dialog closes */
export let draft = null;
export const setDraft = d => { draft = d; };

/* top: the sheet hangs from the top of a phone screen instead of sitting on the bottom, so a
   sheet whose height changes as you use it (the sentence composer) grows downwards and its top
   stays put */
export function openDialog(html, submit, { top = false } = {}){
  if(!dlg.open) rememberTrigger();
  dlg.classList.toggle('top', top);
  form.innerHTML = html; onSubmit = submit;
  /* The sheet is named by its heading */
  const title = form.querySelector('h2'); if(title) title.id = 'dlgTitle';
  if(!dlg.open) dlg.showModal();
  fitToViewport();
  const first = form.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=date]),textarea');
  /* On touch screens, focusing a text field pops the keyboard over half the sheet: focus the heading
     instead, unless the field uses the on-screen keypad (inputmode="none") */
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if(first && (!touch || first.inputMode === 'none')) first.focus();
  else { const h = form.querySelector('h2'); if(h){ h.tabIndex = -1; h.focus(); } }
}
/* On a phone the keyboard covers the bottom of the screen but the page doesn't shrink, so a sheet
   pinned to the top or bottom can end up pushed off-screen. Follow the visible area instead: the
   CSS reads these to size and place the sheet inside whatever the keyboard leaves */
export function fitToViewport(){
  const vv = window.visualViewport, root = document.documentElement.style;
  if(!vv || !dlg.open){ root.removeProperty('--vv-h'); root.removeProperty('--vv-top'); root.removeProperty('--vv-bottom'); return; }
  const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  root.setProperty('--vv-h', vv.height + 'px');
  root.setProperty('--vv-top', vv.offsetTop + 'px');
  root.setProperty('--vv-bottom', bottom + 'px');
}
export function closeDialog(){ if(dlg.open) dlg.close(); onSubmit = null; draft = null; }
/* Show why a save didn't happen. With a field, the message sits under that field, the field is
   marked invalid and focused; without one, it goes in the sheet's general error line */
export function fail(msg, field){
  clearFieldError();
  if(field && msg){
    const p = document.createElement('p');
    p.className = 'err field-err'; p.id = 'fieldErr'; p.textContent = msg;
    let at = field.closest('label, fieldset, .amount, .srow, .mrow') || field;
    /* Side-by-side fields, the rate line and chip rows: the message goes under the whole row */
    if(at.parentElement?.matches('.two, .fxrow, .chips')) at = at.parentElement;
    at.after(p);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'fieldErr');
    field.focus({ preventScroll: true });
    p.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    return false;
  }
  const e = form.querySelector('.err:not(.field-err)'); if(e) e.textContent = msg;
  return false;
}
function clearFieldError(){
  form.querySelector('#fieldErr')?.remove();
  form.querySelectorAll('[aria-invalid]').forEach(f => { f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby'); });
}
/* Every failed save comes through here, so it's also where they get reported: the details go to
   Sentry, and the person gets a sentence that says what to do */
export function describeError(err, action = 'save'){
  reportError(err, action);
  return friendlyError(err, action);
}

/* Tapping the dimmed area around a sheet closes it, like the × or Cancel. A tap has to start and
   end outside the sheet, so dragging a selection out of a text field doesn't close it by accident. */
export function closeOnBackdrop(d, close){
  const outside = ev => {
    if(ev.target !== d) return false;
    const r = d.getBoundingClientRect();
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
  };
  let startedOutside = false;
  d.addEventListener('pointerdown', ev => { startedOutside = outside(ev); });
  d.addEventListener('click', ev => { if(startedOutside && outside(ev)) close(); startedOutside = false; });
}

export function initDialog(){
  closeOnBackdrop(dlg, closeDialog);
  const confirmDlg = $('#confirmDlg');
  if(confirmDlg) closeOnBackdrop(confirmDlg, () => confirmDlg.close());
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if(!onSubmit) return;
    const submitBtn = form.querySelector('button[type=submit]');
    if(submitBtn) submitBtn.disabled = true;
    try{
      const result = await onSubmit();
      /* a handler returns false to keep the dialog open, or a route to go to once saved */
      if(result !== false){ closeDialog(); await refresh(); if(typeof result === 'string') navigate(result); }
    } finally {
      if(submitBtn) submitBtn.disabled = false;
    }
  });
  /* Fixing the field clears its error */
  form.addEventListener('input', ev => { if(ev.target.getAttribute?.('aria-invalid')) clearFieldError(); });
  form.addEventListener('change', ev => { if(ev.target.closest?.('fieldset')?.querySelector('[aria-invalid]')) clearFieldError(); });
  dlg.addEventListener('close', () => { onSubmit = null; draft = null; sheetClosed(); fitToViewport(); });
  window.visualViewport?.addEventListener('resize', fitToViewport);
  window.visualViewport?.addEventListener('scroll', fitToViewport);
  /* Focusing a field makes the browser scroll the page behind to reveal it; the sheet doesn't need that */
  form.addEventListener('focusin', () => {
    if(window.scrollY) window.scrollTo(0, 0);
    /* iOS keeps scrolling while the keyboard slides up, and doesn't always say when it's done */
    [100, 300, 600].forEach(ms => setTimeout(fitToViewport, ms));
  });
  form.addEventListener('focusout', () => setTimeout(fitToViewport, 100));
}
