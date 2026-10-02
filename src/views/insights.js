/* A group's spending, three ways: by category, by month and by who paid. Closed by default, so the
   page stays about settling up. The bars are decoration; every figure is also written out */
import { esc, money } from '../lib/format.js';
import { byCategory, byMonth, paidMost, totalSpent } from '../lib/insights.js';
import { categoryLabel } from '../lib/categories.js';
import { shortName } from '../selectors.js';
import { avatar } from './shared.js';

/* Whether it's open, kept across re-renders (live updates redraw the page) */
let open = false;

const monthName = k => { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const bar = (v, max) => `<span class="ins-bar" aria-hidden="true"><i style="width:${max ? Math.max(2, Math.round(v / max * 100)) : 0}%"></i></span>`;

function list(title, rows, max, cur){
  return `<div class="ins-block"><h3>${title}</h3><ul class="ins-list">${rows.map(r =>
    `<li><span class="ins-name">${r.label}</span>${bar(r.total, max)}<span class="ins-amt">${money(r.total, cur)}</span></li>`).join('')}</ul></div>`;
}

export function insights(g){
  if(!totalSpent(g)) return '';
  const cur = g.currency, cats = byCategory(g), months = byMonth(g), payers = paidMost(g);
  const top = rows => Math.max(...rows.map(r => r.total));
  return `<section class="section" aria-labelledby="insHead">
    <details class="insights" ${open ? 'open' : ''}>
      <summary><h2 id="insHead">Insights</h2></summary>
      <p class="ins-total">${money(totalSpent(g), cur)} spent in all.</p>
      ${list('By category', cats.map(c => ({ label: esc(categoryLabel(c.key)), total: c.total })), top(cats), cur)}
      ${months.length > 1 ? list('By month', months.map(m => ({ label: esc(monthName(m.month)), total: m.total })), top(months), cur) : ''}
      ${list('Who paid most', payers.map(p => ({ label: `${avatar(p.pid, 'sm')} ${esc(shortName(p.pid))}`, total: p.total })), top(payers), cur)}
    </details>
  </section>`;
}
/* Called after the page is drawn, to remember whether it was opened */
export function watchInsights(root){
  root.querySelector('details.insights')?.addEventListener('toggle', ev => { open = ev.target.open; });
}
