/* Calendar maths for the date picker (tested in test/calendar.test.js). Dates are "YYYY-MM-DD"
   strings throughout, never Date objects across a day boundary, so time zones can't shift them. */
const pad = n => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/* "2026-09-13" → { y, m (0-11), d }; null unless it's a real date */
export function parseYmd(s){
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if(!hit) return null;
  const [y, m, d] = [+hit[1], +hit[2] - 1, +hit[3]];
  const t = new Date(Date.UTC(y, m, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m && t.getUTCDate() === d ? { y, m, d } : null;
}

export function addDays(s, n){
  const p = parseYmd(s); if(!p) return s;
  const t = new Date(Date.UTC(p.y, p.m, p.d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/* The month `delta` months from year/month, as { y, m } */
export function shiftMonth({ y, m }, delta){
  const t = new Date(Date.UTC(y, m + delta, 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
}

/* A month as weeks starting on Monday, each day { date, day, inMonth }; the first and last weeks
   are filled out with the neighbouring months' days */
export function monthGrid(y, m){
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for(let i = -lead; i < days + ((7 - (lead + days) % 7) % 7); i++){
    const date = addDays(ymd(y, m, 1), i), p = parseYmd(date);
    cells.push({ date, day: p.d, inMonth: p.m === m });
  }
  const weeks = [];
  for(let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* How the field reads: "Today", "Yesterday", else "Sat 13 Sep" (with the year when it isn't this one) */
export function dateLabel(s, now = new Date()){
  const p = parseYmd(s); if(!p) return 'Pick a date';
  const today = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  if(s === today) return 'Today';
  if(s === addDays(today, -1)) return 'Yesterday';
  const at = new Date(Date.UTC(p.y, p.m, p.d, 12)), part = o => at.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  return `${part({ weekday: 'short' })} ${p.d} ${part({ month: 'short' })}${p.y === now.getFullYear() ? '' : ' ' + p.y}`;
}
export const monthTitle = (y, m) => new Date(Date.UTC(y, m, 1, 12)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const longDate = s => { const p = parseYmd(s); return p ? new Date(Date.UTC(p.y, p.m, p.d, 12)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''; };
