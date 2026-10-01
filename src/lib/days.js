/* Receipt day headings: "Today", "Yesterday", "Saturday" within the week, then "15 September"
   (tested in test/days.test.js) */
const startOf = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export function dayLabel(dateStr, now = Date.now()){
  const d = startOf(new Date(dateStr + 'T12:00:00')), today = startOf(now);
  const days = Math.round((today - d) / 864e5);
  if(days === 0) return 'Today';
  if(days === 1) return 'Yesterday';
  if(days > 1 && days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
/* Entries (already newest first) cut into consecutive days */
export function byDay(items, dateOf, now = Date.now()){
  const out = [];
  for(const it of items){
    const key = dateOf(it);
    if(!out.length || out[out.length - 1].key !== key) out.push({ key, label: dayLabel(key, now), items: [] });
    out[out.length - 1].items.push(it);
  }
  return out;
}
