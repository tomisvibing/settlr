import { sb } from './supabase.js';
import { state, session, myPersonId } from './store.js';
import { toast } from './ui.js';
import { render } from './router.js';
import { reportError } from './monitoring.js';
import { friendlyError } from './lib/errors.js';
import { filterActivity } from './views/receipt.js';
import { safeAvatarUrl } from './lib/avatar.js';

export let lastLoadedAt = 0;

/* Everything the signed-in user can see, reshaped for the UI. RLS decides what "can see" means. */
export async function loadAllData(){
  /* Payment links load alongside but aren't essential: if they fail, everything else still shows */
  const handles = sb.from('pay_handles').select('*');
  const results = await Promise.all([
    sb.from('groups').select('*').order('created_at'),
    sb.from('people').select('*').order('name'),
    sb.from('group_members').select('*'),
    sb.from('expenses').select('*').order('expense_date', { ascending:false }),
    sb.from('expense_splits').select('*'),
    sb.from('payments').select('*').order('payment_date', { ascending:false }),
    sb.from('expense_comments').select('*').order('created_at'),
    sb.from('recurring_expenses').select('*').order('created_at'),
  ]);
  const failed = results.find(r => r.error);
  if(failed) throw failed.error;
  const [groups, people, members, expenses, splits, payments, comments, recurring] = results.map(r => r.data || []);
  const commentsByExpense = {};
  comments.forEach(c => { (commentsByExpense[c.expense_id] ||= []).push({ id: c.id, body: c.body, authorUser: c.author_user, authorPerson: c.author_person, createdAt: new Date(c.created_at).getTime() }); });

  const h = await handles;
  state.payHandles = h.error ? {} : Object.fromEntries((h.data || []).map(r => [r.user_id, r]));
  state.people = people.map(p => ({ id:p.id, name:p.name, userId:p.user_id, photo:safeAvatarUrl(p.avatar_url) }));
  state.myIds = new Set(state.people.filter(p => p.userId === session.user.id).map(p => p.id));
  if(myPersonId) state.myIds.add(myPersonId);

  const splitsByExpense = {};
  splits.forEach(s => { (splitsByExpense[s.expense_id] ||= {})[s.person_id] = s.amount_cents; });

  const expensesByGroup = {};
  expenses.forEach(e => {
    (expensesByGroup[e.group_id] ||= []).push({
      id: e.id, type: e.type, desc: e.description, amount: e.amount_cents,
      paidBy: e.paid_by, splits: splitsByExpense[e.id] || {}, splitMode: e.split_mode,
      splitInput: e.split_input || {}, date: e.expense_date, receipt: e.receipt_path || null,
      comments: commentsByExpense[e.id] || [],
      origCurrency: e.orig_currency || null, origAmount: e.orig_amount_cents ?? null, fxRate: e.fx_rate != null ? Number(e.fx_rate) : null, createdAt: new Date(e.created_at).getTime()
    });
  });

  const recurringByGroup = {};
  recurring.forEach(r => {
    (recurringByGroup[r.group_id] ||= []).push({
      id: r.id, desc: r.description, amount: Number(r.amount_cents), paidBy: r.paid_by, frequency: r.frequency,
      startDate: r.start_date, runs: r.runs, endsOn: r.ends_on || null,
    });
  });

  /* members: who's in the group now; left: who left (their names stay on its history); admins: who runs it */
  const membersByGroup = {}, leftByGroup = {}, adminsByGroup = {};
  members.forEach(m => {
    if(m.left_at) (leftByGroup[m.group_id] ||= []).push(m.person_id);
    else (membersByGroup[m.group_id] ||= []).push(m.person_id);
    if(m.role === 'admin' && !m.left_at) (adminsByGroup[m.group_id] ||= []).push(m.person_id);
  });

  /* Only groups I'm in now. The security rules already hide groups I've left; this keeps the
     screen right in the moment between leaving and the next load */
  const mineNow = g => (membersByGroup[g.id] || []).some(pid => state.myIds.has(pid));
  state.groups = groups.filter(mineNow).map(g => ({
    id: g.id, name: g.name, currency: g.currency, inviteCode: g.invite_code, createdAt: new Date(g.created_at).getTime(),
    archivedAt: g.archived_at ? new Date(g.archived_at).getTime() : null,
    members: membersByGroup[g.id] || [], left: leftByGroup[g.id] || [], admins: adminsByGroup[g.id] || [],
    expenses: expensesByGroup[g.id] || [], recurring: recurringByGroup[g.id] || []
  }));

  state.payments = payments.map(p => ({
    id:p.id, from:p.from_person, to:p.to_person, amount:p.amount_cents, currency:p.currency,
    note:p.note, date:p.payment_date, createdAt:new Date(p.created_at).getTime()
  }));
  lastLoadedAt = Date.now();
}
/* A reload triggered by someone else's change (live.js): no toast on failure, and the activity
   search keeps its text and focus so typing isn't interrupted */
export async function refreshQuietly(){
  try{ await loadAllData(); }
  catch(err){ reportError(err, 'live refresh'); return; }
  const search = document.querySelector('[data-filter=activity]');
  const q = search?.value || '', focused = search && document.activeElement === search;
  render();
  const again = document.querySelector('[data-filter=activity]');
  if(again && q){ again.value = q; filterActivity(q); }
  if(again && focused) again.focus();
}
export async function refresh(){
  try{ await loadAllData(); }
  catch(err){ reportError(err, 'refresh'); toast(friendlyError(err, 'refresh'), { error: true }); }
  render();
}
