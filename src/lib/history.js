/* Turns activity_log rows into sentences for a group's History sheet (tested in test/history.test.js).
   ctx: { name(personId), money(hundredths), isMe(userId), exists(entryId) } */

const who = (ev, ctx) => ctx.isMe(ev.actor_user) ? 'You' : (ev.actor_name || 'Someone');
const title = s => s?.description || 'an entry';

/* How a stored entry reads: "Fondue · CHF 45.00" or "Payment: Bob → Alice · €15.00" */
function amountOf(s, ctx){
  if(!s) return '';
  const spent = s.orig_currency ? ctx.money(s.orig_amount_cents, s.orig_currency) : ctx.money(s.amount_cents);
  return s.orig_currency ? `${spent} (${ctx.money(s.amount_cents)})` : spent;
}

/* What changed between two versions of an entry, in plain words */
export function changes(before, after, ctx){
  if(!before || !after) return [];
  const out = [];
  if(before.description !== after.description) out.push(`renamed it “${after.description}”`);
  if(before.amount_cents !== after.amount_cents || before.orig_amount_cents !== after.orig_amount_cents || before.orig_currency !== after.orig_currency)
    out.push(`${amountOf(before, ctx)} → ${amountOf(after, ctx)}`);
  if(before.paid_by !== after.paid_by) out.push(`paid by ${ctx.name(after.paid_by)}`);
  if(before.expense_date !== after.expense_date) out.push(`date ${after.expense_date}`);
  if(before.split_mode !== after.split_mode || JSON.stringify(before.split_input) !== JSON.stringify(after.split_input)) out.push('changed the split');
  return out;
}

/* { text, restore } for one event; restore is the entry id when it can still be brought back */
export function describe(ev, ctx){
  const w = who(ev, ctx), d = ev.data || {}, isPay = ev.entity === 'payment';
  const s = d.after || d.before;
  const thing = isPay ? `a payment from ${ctx.name(s?.paid_by)}` : `“${title(s)}”`;
  switch(ev.action){
    case 'added': return { text: `${w} ${isPay ? 'recorded' : 'added'} ${thing} · ${amountOf(d.after, ctx)}` };
    case 'edited': {
      const c = changes(d.before, d.after, ctx);
      return { text: `${w} edited ${isPay ? 'a payment' : `“${title(d.before)}”`}${c.length ? ': ' + c.join(', ') : ''}` };
    }
    case 'deleted': return { text: `${w} deleted ${thing} · ${amountOf(d.before, ctx)}`, restore: ctx.exists(ev.entity_id) ? null : ev.entity_id };
    case 'restored':
      if(ev.entity === 'group') return { text: `${w} restored the group from the archive` };
      return { text: `${w} brought back ${isPay ? 'a payment' : `“${title(d.after)}”`}` };
    case 'created': return { text: `${w} started the group` };
    case 'renamed': return { text: `${w} renamed the group “${d.to}”` };
    case 'archived': return { text: `${w} archived the group` };
    case 'joined': return { text: `${d.name || 'Someone'} joined` };
    case 'rejoined': return { text: `${d.name || 'Someone'} rejoined` };
    case 'left': return { text: `${d.name || 'Someone'} left the group` };
    case 'removed': return { text: `${w} removed ${d.name || 'someone'}` };
    case 'made_admin': return { text: `${w} made ${d.name || 'someone'} an admin` };
    case 'unmade_admin': return { text: `${d.name || 'Someone'} is no longer an admin` };
    default: return { text: `${w} made a change` };
  }
}
