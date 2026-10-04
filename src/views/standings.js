/* "Who's up, who's down" in words, like Home: "You're up £811.04", "Alex is down
   £399.52". What someone is down is red; where it comes from sits underneath */
import { esc, money } from '../lib/format.js';
import { isMe } from '../selectors.js';
import { avatar } from './shared.js';

const join = list => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list.at(-1) : list[0];

/* rows: { pid, name, amounts: [[currency, value]], sub?, action? (the row becomes a button with
   data-action and data-id) } */
export function standings(rows, label){
  return `<ul class="standings" aria-label="${esc(label)}">${rows.map(r => {
    const ups = r.amounts.filter(([, v]) => v > 0), downs = r.amounts.filter(([, v]) => v < 0);
    const amt = (list, tone) => join(list.map(([c, v]) => `<em class="${tone}">${money(Math.abs(v), c)}</em>`));
    const what = [ups.length && `up ${amt(ups, 'up')}`, downs.length && `down ${amt(downs, 'down')}`].filter(Boolean);
    const who = isMe(r.pid) ? 'You’re' : `${esc(r.name)} is`;
    const inner = `${avatar(r.pid)}<span class="st-text"><span class="st-line">${who} ${what.length ? what.join(' and ') : 'square'}</span>${r.sub ? `<span class="st-sub">${esc(r.sub)}</span>` : ''}</span>`;
    return `<li>${r.action
      ? `<button type="button" class="st-row" data-action="${r.action}" data-id="${r.pid}">${inner}</button>`
      : `<div class="st-row">${inner}</div>`}</li>`;
  }).join('')}</ul>`;
}
