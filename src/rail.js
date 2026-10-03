/* The wide-screen sidebar can fold down to an icon rail. Remembered on this device */
const KEY = 'settlr:rail';
const read = () => { try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; } };

export function applyRail(){
  const on = read();
  document.body.classList.toggle('rail', on);
  const b = document.querySelector('.rail-toggle'); if(!b) return;
  b.setAttribute('aria-expanded', String(!on));
  const label = on ? 'Expand sidebar' : 'Collapse sidebar';
  b.setAttribute('aria-label', label); b.title = label;
}
export function toggleRail(){
  try{ localStorage.setItem(KEY, read() ? '0' : '1'); }catch(e){ /* private mode: just not remembered */ }
  applyRail();
}
