/* "Where it all went": spending across every group, in your home currency at today's rates */
import { $, esc, money } from '../lib/format.js';
import { state } from '../store.js';
import { spendingAcross } from '../lib/spending.js';
import { categoryLabel } from '../lib/categories.js';
import { rates, load } from '../homeRates.js';
import { homeCurrency } from '../prefs.js';

const bars = (rows, home, label) => { const top = Math.max(...rows.map(r => r.amount), 1); return `<ul class="bars" aria-label="${esc(label)}">${rows.map(r => `<li><span class="b-lbl">${esc(r.label)}</span><span class="b-track" aria-hidden="true"><span class="b-fill" style="width:${Math.max(2, Math.round(r.amount / top * 100))}%"></span></span><span class="b-amt">${money(r.amount, home)}</span></li>`).join('')}</ul>`; };

export function spendingSection(rerender){
  const groups = state.groups.filter(g => g.expenses.some(e => e.type !== 'payment'));
  if(!groups.length) return '';
  const home = homeCurrency();
  const heading = `<div class="section-head"><h2 id="allSpendHead">Where it all went</h2></div>`;
  if(load(groups.map(g => g.currency), () => { if($('#allSpend')) rerender(); }))
    return `<section class="section" id="allSpend" aria-labelledby="allSpendHead">${heading}<p class="none">Adding it all up in ${home}…</p></section>`;
  const r = spendingAcross(groups, rates, home);
  if(!r.byGroup.length) return '';
  return `<section class="section" id="allSpend" aria-labelledby="allSpendHead">${heading}
    <p class="spend-lead"><b>${money(r.total, home)}</b> across ${r.byGroup.length} ${r.byGroup.length === 1 ? 'group' : 'groups'}, at today’s rates${r.missing.length ? `, not counting ${r.missing.join(', ')}` : ''}.</p>
    ${r.byGroup.length > 1 ? bars(r.byGroup.map(x => ({ label: x.name, amount: x.amount })), home, 'Spending by group') : ''}
    ${r.byCategory.some(x => x.category) ? bars(r.byCategory.map(x => ({ label: categoryLabel(x.category), amount: x.amount })), home, 'Spending by category') : ''}
  </section>`;
}
