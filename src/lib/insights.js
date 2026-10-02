/* What a group has spent, three ways (tested in test/insights.test.js): by category, by month and by
   who paid. Pure; amounts are hundredths in the group's currency. Payments between people aren't
   spending, so they're left out of all of it. */
const spending = g => g.expenses.filter(e => e.type !== 'payment');

export const totalSpent = g => spending(g).reduce((s, e) => s + e.amount, 0);

/* [{ key, total, count }], biggest first; entries with no category are grouped under key null */
export function byCategory(g){
  const m = new Map();
  for(const e of spending(g)){
    const k = e.category || null, x = m.get(k) || { key: k, total: 0, count: 0 };
    x.total += e.amount; x.count++; m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/* [{ month: '2026-09', total, count }], oldest first, with the months in between that had no spending
   filled in as zero so a chart doesn't skip them */
export function byMonth(g){
  const m = new Map();
  for(const e of spending(g)){
    const k = (e.date || '').slice(0, 7); if(!/^\d{4}-\d{2}$/.test(k)) continue;
    const x = m.get(k) || { month: k, total: 0, count: 0 };
    x.total += e.amount; x.count++; m.set(k, x);
  }
  const keys = [...m.keys()].sort(); if(!keys.length) return [];
  const out = [];
  let [y, mo] = keys[0].split('-').map(Number); const [ly, lm] = keys.at(-1).split('-').map(Number);
  while(y < ly || (y === ly && mo <= lm)){
    const k = `${y}-${String(mo).padStart(2, '0')}`;
    out.push(m.get(k) || { month: k, total: 0, count: 0 });
    if(++mo > 12){ mo = 1; y++; }
  }
  return out;
}

/* [{ pid, total, count }]: what each person paid up front, biggest first. Anyone who has paid for
   something is listed, members or not (someone may have left since) */
export function paidMost(g){
  const m = new Map();
  for(const e of spending(g)){
    const x = m.get(e.paidBy) || { pid: e.paidBy, total: 0, count: 0 };
    x.total += e.amount; x.count++; m.set(e.paidBy, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
