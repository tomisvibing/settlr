/* Spending across every group in your home currency (tested in test/spending.test.js). `rates` maps a
   currency to what one unit is worth in `home`; groups in a currency with no rate are named in
   `missing` and left out. Amounts are hundredths. */
import { insights } from './insights.js';
import { minorStep } from './format.js';

export function spendingAcross(groups, rates, home){
  const step = minorStep(home), fx = cur => cur === home ? 1 : rates[cur] > 0 ? rates[cur] : 0;
  const round = v => Math.round(v / step) * step;
  const byGroup = [], cats = new Map(), missing = new Set();
  for(const g of groups){
    const i = insights(g), rate = fx(g.currency);
    if(!i.count) continue;
    if(!rate){ missing.add(g.currency); continue; }
    byGroup.push({ id: g.id, name: g.name, amount: round(i.total * rate) });
    i.byCategory.forEach(c => cats.set(c.category, (cats.get(c.category) || 0) + c.amount * rate));
  }
  byGroup.sort((a, b) => b.amount - a.amount);
  return {
    total: byGroup.reduce((s, x) => s + x.amount, 0), byGroup,
    byCategory: [...cats].map(([category, amount]) => ({ category, amount: round(amount) })).sort((a, b) => b.amount - a.amount),
    missing: [...missing],
  };
}
