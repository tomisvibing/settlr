/* The overview's opening paragraph: who owes you, who you owe and what's square, in words
   (tested in test/story.test.js). Pure: give it groups and a way to recognise you */
import { paymentPlan } from './ledger.js';

/* Pairwise debts between you and each person, from each group's fewest-payments plan */
export function whoOwesWhom(groups, isMe){
  const owedToMe = new Map(), iOwe = new Map(), square = [];
  const add = (map, pid, cur, amount, gname) => {
    const x = map.get(pid) || { pid, amounts: {}, groups: new Set() };
    x.amounts[cur] = (x.amounts[cur] || 0) + amount;
    x.groups.add(gname);
    map.set(pid, x);
  };
  for(const g of groups){
    if(!g.members.some(isMe)) continue;
    const plan = paymentPlan(g);
    let mine = false;
    for(const p of plan){
      if(isMe(p.to) && !isMe(p.from)){ add(owedToMe, p.from, g.currency, p.amount, g.name); mine = true; }
      else if(isMe(p.from) && !isMe(p.to)){ add(iOwe, p.to, g.currency, p.amount, g.name); mine = true; }
    }
    if(!mine && !g.archivedAt && g.expenses.length) square.push(g.name);
  }
  /* Biggest first: by the largest single amount, which is fair enough across currencies */
  const big = x => Math.max(...Object.values(x.amounts));
  return { owedToMe: [...owedToMe.values()].sort((a, c) => big(c) - big(a)), iOwe: [...iOwe.values()].sort((a, c) => big(c) - big(a)), square };
}

/* The paragraph as a list of parts: plain text, {person} (to link) and {amount, up|down} (to set in
   italics or red). The view decides the markup; tests read it back as text */
export function storyParts(groups, isMe, nameOf, money){
  const { owedToMe, iOwe, square } = whoOwesWhom(groups, isMe);
  const parts = [];
  const t = s => parts.push(s);
  /* One person's amounts in several currencies: "£10.00 and €20.00", or "plus" when "and" already
     joins two people in the same sentence */
  const amounts = (x, tone, two) => Object.entries(x.amounts).forEach(([cur, v], i, all) => {
    if(i) t(i < all.length - 1 ? ', ' : two ? ' plus ' : ' and ');
    parts.push({ amount: money(v, cur), tone });
  });
  const others = n => n === 1 ? 'one more person' : `${n} more people`;
  const oneGroup = list => { const all = new Set(list.flatMap(x => [...x.groups])); return all.size === 1 ? [...all][0] : null; };

  if(owedToMe.length){
    const [a, b] = owedToMe, rest = owedToMe.length - 2;
    parts.push({ person: a.pid, name: nameOf(a.pid) }); t(' owes you '); amounts(a, 'up', !!b);
    if(b){ t(rest > 0 ? ', ' : ' and '); parts.push({ person: b.pid, name: nameOf(b.pid) }); t(' '); amounts(b, 'up', true); }
    if(rest > 0) t(`, and ${others(rest)} owe${rest === 1 ? 's' : ''} you too`);
    const g = oneGroup(owedToMe);
    if(g) t(owedToMe.length === 1 ? `, from ${g}` : owedToMe.length === 2 ? `, both from ${g}` : `, all from ${g}`);
    t('. ');
  }
  if(iOwe.length){
    const [a, b] = iOwe, rest = iOwe.length - 2;
    t('You owe '); parts.push({ person: a.pid, name: nameOf(a.pid) }); t(' '); amounts(a, 'down', !!b);
    if(b){ t(rest > 0 ? ', ' : ' and '); parts.push({ person: b.pid, name: nameOf(b.pid) }); t(' '); amounts(b, 'down', true); }
    if(rest > 0) t(`, and ${others(rest)}`);
    const g = oneGroup(iOwe);
    if(g) t(` for ${g}`);
    t('. ');
  }
  if(!owedToMe.length && !iOwe.length){
    t(groups.some(g => g.expenses.length) ? 'Everything’s square. Nobody owes anybody.' : 'Nothing to settle yet. Add an expense and it’ll show up here.');
  } else if(square.length){
    t(square.length === 1 ? `${square[0]} is square.` : square.length === 2 ? `${square[0]} and ${square[1]} are square.` : `${square.length} other groups are square.`);
  }
  /* Tidy the join: no trailing space */
  const last = parts.length - 1;
  if(typeof parts[last] === 'string') parts[last] = parts[last].replace(/\s+$/, '');
  return parts;
}
export const storyText = parts => parts.map(p => typeof p === 'string' ? p : p.name ?? p.amount).join('');
