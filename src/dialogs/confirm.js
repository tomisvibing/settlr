/* A small confirm sheet in place of the browser's confirm(). Its own <dialog>, so it can open
   on top of an open sheet (e.g. "Delete this expense?" from the edit sheet). */
import { $, esc } from '../lib/format.js';

export function askConfirm({ title, body = '', confirmLabel = 'Delete', danger = true }){
  const dlg = $('#confirmDlg');
  dlg.innerHTML = `<form method="dialog">
    <h2 id="confirmTitle">${esc(title)}</h2>
    ${body ? `<p class="hint" id="confirmBody">${esc(body)}</p>` : ''}
    <div class="dlg-actions"><span class="sp"></span>
      <button class="btn" value="no">Cancel</button>
      <button class="btn ${danger ? 'destroy' : 'primary'}" value="yes">${esc(confirmLabel)}</button>
    </div>
  </form>`;
  return new Promise(resolve => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
    if(body) dlg.setAttribute('aria-describedby', 'confirmBody'); else dlg.removeAttribute('aria-describedby');
    dlg.returnValue = '';
    dlg.showModal();
    dlg.querySelector('button[value=no]').focus();
  });
}
