/* Repeating expenses (tested in test/recurring.test.js). The dates match private.recurring_due in
   supabase/migrations/20261001090000_recurring_expenses.sql: occurrence n is the start date plus n
   periods, so a bill starting on the 31st lands on the 28th in February and the 31st again in March */
export const FREQUENCIES = [['weekly', 'every week'], ['fortnightly', 'every two weeks'], ['monthly', 'every month'], ['yearly', 'every year']];

const iso = d => d.toISOString().slice(0, 10);
const utc = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addMonths = (s, n) => {
  const d = utc(s), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return iso(d);
};
export function dueDate(start, frequency, n = 0){
  if(frequency === 'weekly' || frequency === 'fortnightly'){ const d = utc(start); d.setUTCDate(d.getUTCDate() + (frequency === 'weekly' ? 7 : 14) * n); return iso(d); }
  return addMonths(start, frequency === 'yearly' ? 12 * n : n);
}
/* The first repeat after an expense dated `date` */
export const firstRepeat = (date, frequency) => dueDate(date, frequency, 1);
/* When a saved schedule next adds an expense, or null once it has ended */
export function nextDate(r){
  const d = dueDate(r.startDate, r.frequency, r.runs);
  return r.endsOn && d > r.endsOn ? null : d;
}
export const frequencyLabel = f => FREQUENCIES.find(([v]) => v === f)?.[1] || f;
