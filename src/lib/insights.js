/* What a group has spent, read back as numbers (tested in test/insights.test.js). Payments between
   people aren't spending, so they're left out. Amounts are hundredths of the group's currency. */

const monthOf = date => String(date || '').slice(0, 7);

export function insights(g){
  const spent = g.expenses.filter(e => e.type !== 'payment');
  const sum = (map, key, v) => map.set(key, (map.get(key) || 0) + v);
  const months = new Map(), paid = new Map(), share = new Map();
  let total = 0, biggest = null;
  for(const e of spent){
    total += e.amount;
    sum(months, monthOf(e.date), e.amount);
    sum(paid, e.paidBy, e.amount);
    for(const [pid, v] of Object.entries(e.splits)) sum(share, pid, v);
    if(!biggest || e.amount > biggest.amount) biggest = e;
  }
  const ranked = map => [...map].map(([pid, amount]) => ({ pid, amount })).sort((a, b) => b.amount - a.amount);
  return {
    count: spent.length, total, biggest,
    byMonth: [...months].map(([month, amount]) => ({ month, amount })).filter(m => m.month).sort((a, b) => a.month.localeCompare(b.month)),
    paidBy: ranked(paid), shareOf: ranked(share),
  };
}

/* "2026-10" → "Oct 2026" */
export const monthLabel = m => new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
