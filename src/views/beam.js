/* "Who's up, who's down": everyone's balance on one line. Bars grow right of the middle for money
   owed to someone (teal), left for money they owe (red). To scale within one currency; the value is
   always written beside the bar, so colour never carries the meaning alone */
import { esc, money } from '../lib/format.js';
import { avatar } from './shared.js';

/* rows: { pid, name, value (pence), say (full sentence for screen readers), tip (detail on hover),
   action? (make the row a button: data-action and data-id) } */
export function beam(rows, cur, label, { legend = true } = {}){
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  return `${legend ? '<div class="legend" aria-hidden="true"><span><i></i>Owed money</span><span><i class="down"></i>Owes money</span></div>' : ''}
  <ul class="beam" aria-label="${esc(label)}">${rows.map(r => {
    const up = r.value >= 0, w = (Math.abs(r.value) / max * 46).toFixed(2);
    const val = r.value === 0 ? 'Square' : `${up ? '+' : '−'}${money(Math.abs(r.value), cur)}`;
    const inner = `<span class="b-who">${avatar(r.pid, 'sm')}<span>${esc(r.name)}</span></span>
      <span class="b-track" aria-hidden="true">${r.value ? `<span class="b-bar ${up ? 'up' : 'down'}" style="width:${w}%"></span>` : ''}</span>
      <span class="b-val" aria-hidden="true">${val}</span>`;
    const tip = r.tip ? ` data-tip="${esc(r.tip)}"` : '';
    return `<li>${r.action
      ? `<button type="button" class="bar-row" data-action="${r.action}" data-id="${r.pid}" aria-label="${esc(r.say)}"${tip}>${inner}</button>`
      : `<div class="bar-row" tabindex="0" role="group" aria-label="${esc(r.say)}${r.tip ? '. ' + esc(r.tip) : ''}"${tip}>${inner}</div>`}</li>`;
  }).join('')}</ul>`;
}

/* One tooltip for every line on the page, on hover and on keyboard focus */
export function initBeamTips(){
  const tip = document.createElement('div');
  tip.className = 'b-tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);
  const show = el => {
    const r = el.getBoundingClientRect();
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const w = Math.min(260, innerWidth - 24);
    tip.style.maxWidth = w + 'px';
    tip.style.left = Math.max(12, Math.min(r.left + 88, innerWidth - w - 12)) + 'px';
    tip.style.top = (r.bottom + 4) + 'px';
  };
  const hide = () => { tip.hidden = true; };
  document.addEventListener('pointerover', ev => { const el = ev.target.closest?.('.bar-row[data-tip]'); if(el) show(el); else hide(); });
  document.addEventListener('focusin', ev => { const el = ev.target.closest?.('.bar-row[data-tip]'); if(el) show(el); else hide(); });
  addEventListener('scroll', hide, { passive: true });
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape') hide(); });
}
