/* One shared <dialog>: each dialog renders its form HTML into it and supplies a submit handler */
import { $ } from '../lib/format.js';
import { refresh } from '../data.js';
import { navigate } from '../router.js';
import { reportError } from '../monitoring.js';

export const dlg = $('#dlg'), form = $('#dlgForm');
let onSubmit = null;
/* Per-dialog working state (e.g. the split being edited); reset when the dialog closes */
export let draft = null;
export const setDraft = d => { draft = d; };

export function openDialog(html, submit){
  form.innerHTML = html; onSubmit = submit;
  if(!dlg.open) dlg.showModal();
  const first = form.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=date]),textarea');
  /* On touch screens, focusing a text field pops the keyboard over half the sheet: focus the heading
     instead, unless the field uses the on-screen keypad (inputmode="none") */
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if(first && (!touch || first.inputMode === 'none')) first.focus();
  else { const h = form.querySelector('h2'); if(h){ h.tabIndex = -1; h.focus(); } }
}
export function closeDialog(){ if(dlg.open) dlg.close(); onSubmit = null; draft = null; }
export function fail(msg){ const e = form.querySelector('.err'); if(e) e.textContent = msg; return false; }
/* Every failed save comes through here, so it's also where they get reported */
export function describeError(err){
  reportError(err, 'save');
  return [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ') || 'Could not save. Try again.';
}

export function initDialog(){
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
  dlg.addEventListener('close', () => { onSubmit = null; draft = null; });
}
