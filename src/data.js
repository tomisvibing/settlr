import { sb } from './supabase.js';
import { state, session, myPersonId } from './store.js';
import { toast } from './ui.js';
import { render } from './router.js';
import { reportError } from './monitoring.js';

export let lastLoadedAt = 0;

/* Everything the signed-in user can see, reshaped for the UI. RLS decides what "can see" means. */
export async function loadAllData(){
  const results = await Promise.all([
    sb.from('groups').select('*').order('created_at'),
    sb.from('people').select('*').order('name'),
    sb.from('group_members').select('*'),
    sb.from('expenses').select('*').order('expense_date', { ascending:false }),
    sb.from('expense_splits').select('*'),
    sb.from('payments').select('*').order('payment_date', { ascending:false }),
  ]);
  const failed = results.find(r => r.error);
  if(failed) throw failed.error;
  const [groups, people, members, expenses, splits, payments] = results.map(r => r.data || []);

  state.people = people.map(p => ({ id:p.id, name:p.name, userId:p.user_id }));
  state.myIds = new Set(state.people.filter(p => p.userId === session.user.id).map(p => p.id));
  if(myPersonId) state.myIds.add(myPersonId);

  const splitsByExpense = {};
  splits.forEach(s => { (splitsByExpense[s.expense_id] ||= {})[s.person_id] = s.amount_cents; });

  const expensesByGroup = {};
  expenses.forEach(e => {
    (expensesByGroup[e.group_id] ||= []).push({
      id: e.id, type: e.type, desc: e.description, amount: e.amount_cents,
      paidBy: e.paid_by, splits: splitsByExpense[e.id] || {}, splitMode: e.split_mode,
      splitInput: e.split_input || {}, date: e.expense_date, receipt: e.receipt_path || null, createdAt: new Date(e.created_at).getTime()
    });
  });

  const membersByGroup = {};
  members.forEach(m => { (membersByGroup[m.group_id] ||= []).push(m.person_id); });

  state.groups = groups.map(g => ({
    id: g.id, name: g.name, currency: g.currency, inviteCode: g.invite_code, createdAt: new Date(g.created_at).getTime(),
    members: membersByGroup[g.id] || [], expenses: expensesByGroup[g.id] || []
  }));

  state.payments = payments.map(p => ({
    id:p.id, from:p.from_person, to:p.to_person, amount:p.amount_cents, currency:p.currency,
    note:p.note, date:p.payment_date, createdAt:new Date(p.created_at).getTime()
  }));
  lastLoadedAt = Date.now();
}
export async function refresh(){
  try{ await loadAllData(); }
  catch(err){ reportError(err, 'refresh'); toast(`Couldn't refresh: ${err.message || 'check your connection'}`); }
  render();
}
