/* The money maths. Amounts are integer pence throughout. */

/* Split an integer total by weights, largest-remainder so pennies always add up */
export function distribute(total, weights, step = 1){
  /* Whole units for currencies without pence (a ¥1,000 bill split three ways is ¥334 + ¥333 + ¥333) */
  if(step > 1 && total % step === 0){
    const out = distribute(total / step, weights);
    if(out) for(const id in out) out[id] *= step;
    return out;
  }
  const ids = Object.keys(weights).filter(id => weights[id] > 0);
  const W = ids.reduce((s,id) => s + weights[id], 0);
  if(!W) return null;
  const rows = ids.map(id => { const exact = total*weights[id]/W; const base = Math.floor(exact); return {id, base, rem: exact-base}; });
  let left = total - rows.reduce((s,r) => s + r.base, 0);
  rows.sort((a,b) => b.rem - a.rem);
  for(let k=0; k<left; k++) rows[k % rows.length].base++;
  const out = {}; rows.forEach(r => out[r.id] = r.base); return out;
}
/* Each member's balance in a group: positive is owed, negative owes */
export function balances(g){
  const b = {}; g.members.forEach(id => b[id] = 0);
  g.expenses.forEach(e => {
    if(e.paidBy in b) b[e.paidBy] += e.amount;
    for(const [id,v] of Object.entries(e.splits)) if(id in b) b[id] -= v;
  });
  return b;
}
/* Fewest-transfers settle-up: greedy match largest debtor to largest creditor */
export function settlements(b){
  const cr = [], db = [];
  for(const [id,v] of Object.entries(b)){ if(v>0) cr.push({id,v}); else if(v<0) db.push({id,v:-v}); }
  cr.sort((a,c) => c.v-a.v); db.sort((a,c) => c.v-a.v);
  const out = []; let i=0, j=0;
  while(i<db.length && j<cr.length){
    const x = Math.min(db[i].v, cr[j].v);
    out.push({from:db[i].id, to:cr[j].id, amount:x});
    db[i].v -= x; cr[j].v -= x;
    if(!db[i].v) i++; if(!cr[j].v) j++;
  }
  return out;
}
