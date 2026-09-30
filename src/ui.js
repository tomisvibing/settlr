import { $ } from './lib/format.js';

let toastTimer = null;
/* A short message at the bottom. With an action ("Undo"), it stays longer and the button works */
export function toast(msg, { action, onAction, ms } = {}){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('has-action', !!action);
  if(action){
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = action;
    b.addEventListener('click', () => { el.classList.remove('show'); clearTimeout(toastTimer); onAction?.(); }, { once: true });
    el.append(' ', b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms || (action ? 8000 : 2600));
}
export function download(filename, text, type){
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
