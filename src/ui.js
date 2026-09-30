import { $ } from './lib/format.js';

let toastTimer = null;
/* Hiding also drops its buttons, so nobody can Tab onto an invisible Undo */
const hideToast = () => { clearTimeout(toastTimer); const el = $('#toast'); el.classList.remove('show'); el.querySelectorAll('button').forEach(b => b.remove()); };
/* A short message at the bottom. A plain one fades after a few seconds; one with an action ("Undo")
   or an error stays until it's dismissed, so nobody loses the only way back to it */
export function toast(msg, { action, onAction, error = false, ms } = {}){
  const el = $('#toast');
  const sticky = !!action || error;
  el.textContent = '';
  const text = document.createElement('span'); text.textContent = msg;
  el.append(text);
  el.classList.toggle('sticky', sticky);
  if(action){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-act'; b.textContent = action;
    b.addEventListener('click', () => { hideToast(); onAction?.(); }, { once: true });
    el.append(b);
  }
  if(sticky){
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    x.addEventListener('click', hideToast, { once: true });
    el.append(x);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  if(!sticky) toastTimer = setTimeout(hideToast, ms || 5000);
}
export function initToast(){
  /* Escape dismisses a toast that's waiting, unless a sheet is open (Escape closes that first) */
  document.addEventListener('keydown', ev => {
    if(ev.key === 'Escape' && $('#toast').classList.contains('show') && !document.querySelector('dialog[open]')) hideToast();
  });
}

/* Where focus goes back to once a sheet closes. Saving re-renders the page, which removes the
   button that opened the sheet, so remember what it was and find its replacement */
let lastTrigger = null, restorePending = false;
export function rememberTrigger(){
  const a = document.activeElement;
  if(!a || a === document.body || a.closest('dialog')) return;
  lastTrigger = { el: a, action: a.dataset.action, id: a.dataset.id };
}
export function sheetClosed(){ restorePending = !!lastTrigger; }
export function forgetTrigger(){ lastTrigger = null; restorePending = false; }
/* After a render: put focus back on the trigger (or its re-rendered twin), else on the page itself */
export function restoreFocus(){
  if(!restorePending || document.querySelector('dialog[open]')) return;
  const t = lastTrigger; forgetTrigger();
  const active = document.activeElement;
  if(active && active !== document.body && active.isConnected) return;
  let el = t.el.isConnected ? t.el : null;
  if(!el && t.action) el = document.querySelector(`[data-action="${CSS.escape(t.action)}"]${t.id ? `[data-id="${CSS.escape(t.id)}"]` : ''}`);
  (el || $('#app')).focus({ preventScroll: true });
}

export function download(filename, text, type){
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
