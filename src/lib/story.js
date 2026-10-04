/* Home's opening paragraph: who owes you, who you owe and what's square, in words
   (tested in test/story.test.js). Pure: give it groups and a way to recognise you */
import { paymentPlan } from './ledger.js';

/* What's between you and each person: a signed amount per currency (+ they owe you, − you owe them),
   and the parts it's made of. Each part is a group's settle-up payment, or a settlement made outside
   any group (where: null). A settlement you paid them counts towards what they owe you, as on People */
export function between(groups, isMe, payments = []){
  const out = new Map();
  const add = (pid, cur, amount, where) => {
    const x = out.get(pid) || { pid, amounts: {}, parts: [] };
    x.amounts[cur] = (x.amounts[cur] || 0) + amount;
    const same = x.parts.find(p => p.where === where && p.cur === cur);
    if(same) same.amount += amount; else x.parts.push({ where, cur, amount });
    out.set(pid, x);
  };
  for(const g of groups){
    if(!g.members.some(isMe)) continue;
    for(const p of paymentPlan(g)){
      if(isMe(p.to) && !isMe(p.from)) add(p.from, g.currency, p.amount, g.name);
      else if(isMe(p.from) && !isMe(p.to)) add(p.to, g.currency, -p.amount, g.name);
    }
  }
  for(const p of payments){
    if(isMe(p.from) && !isMe(p.to)) add(p.to, p.currency, p.amount, null);
    else if(isMe(p.to) && !isMe(p.from)) add(p.from, p.currency, -p.amount, null);
  }
  return out;
}

/* Who owes you and who you owe, netted per person: someone who owes you in one group while you owe
   them in another appears once, on whichever side the difference falls */
export function whoOwesWhom(groups, isMe){
  const owedToMe = [], iOwe = [];
  for(const x of between(groups, isMe).values()){
    const side = sign => {
      const amounts = {};
      for(const [cur, v] of Object.entries(x.amounts)) if(Math.sign(v) === sign) amounts[cur] = Math.abs(v);
      const groups = new Set(x.parts.filter(p => p.cur in amounts).map(p => p.where));
      return Object.keys(amounts).length ? { pid: x.pid, amounts, groups } : null;
    };
    const up = side(1), down = side(-1);
    if(up) owedToMe.push(up);
    if(down) iOwe.push(down);
  }
  const square = groups.filter(g => g.members.some(isMe) && !g.archivedAt && g.expenses.length
    && !paymentPlan(g).some(p => isMe(p.to) !== isMe(p.from))).map(g => g.name);
  /* Biggest first: by the largest single amount, which is fair enough across currencies */
  const big = x => Math.max(...Object.values(x.amounts));
  return { owedToMe: owedToMe.sort((a, c) => big(c) - big(a)), iOwe: iOwe.sort((a, c) => big(c) - big(a)), square };
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
