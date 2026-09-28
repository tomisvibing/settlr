export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* A date as YYYY-MM-DD in local time */
export const isoDate = d => { const x = new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); };
export const today = () => isoDate(new Date());
export const CURRENCIES = ['GBP','EUR','USD','CHF','SEK','NOK','DKK','AUD','CAD','NZD'];

export function money(p, cur){
  try{ return new Intl.NumberFormat('en-GB',{style:'currency',currency:cur}).format(p/100); }
  catch(e){ return (p/100).toFixed(2) + ' ' + cur; }
}
/* "12.50", "£12.50", "12" → pence. Blank → 0, junk → NaN */
export function toPence(v){
  const s = String(v ?? '').replace(/[^0-9.-]/g,'');
  if(s === '' ) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n*100) : NaN;
}
/* "€" for EUR, "CHF" for CHF: whatever the locale puts in front of the number */
export function currencySymbol(cur){
  try{ return new Intl.NumberFormat('en-GB',{style:'currency',currency:cur}).formatToParts(0).find(p => p.type === 'currency').value; }
  catch(e){ return cur; }
}
export function dayMonth(e){
  const d = e.date ? new Date(e.date+'T12:00:00') : new Date(e.createdAt);
  return { day: d.getDate(), mon: d.toLocaleDateString('en-GB',{month:'short'}) };
}
export function ago(ts, now = Date.now()){
  if(!ts) return '';
  const start = d => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
  const days = Math.round((start(now) - start(ts)) / 864e5);
  if(days <= 0) return 'today';
  if(days === 1) return 'yesterday';
  if(days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short', year: days > 300 ? 'numeric' : undefined});
}
export const byNewest = (a,c) => (c.date||'').localeCompare(a.date||'') || c.createdAt - a.createdAt;
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'settlr';
export const initial = s => ([...String(s||'').trim()][0] || '?').toUpperCase();
