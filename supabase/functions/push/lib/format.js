export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* A date as YYYY-MM-DD in local time */
export const isoDate = d => { const x = new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); };
export const today = () => isoDate(new Date());
/* The usual three first, then the rest: Europe, the Americas, Asia-Pacific, Middle East and Africa */
export const CURRENCIES = [
  'GBP','EUR','USD',
  'BGN','CHF','CZK','DKK','HUF','ISK','NOK','PLN','RON','RSD','SEK','TRY','UAH',
  'ARS','BRL','CAD','CLP','COP','MXN','PEN','UYU',
  'AUD','CNY','HKD','IDR','INR','JPY','KRW','LKR','MYR','NZD','PHP','SGD','THB','TWD','VND',
  'AED','EGP','ILS','JOD','KES','MAD','NGN','QAR','SAR','TZS','ZAR',
];
/* A currency for where someone is, from their browser's language ("en-GB" → GBP): the euro for the
   countries that use it, else a short table of the rest, else GBP */
const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const REGION_CUR = { GB:'GBP', US:'USD', CA:'CAD', AU:'AUD', NZ:'NZD', CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK', PL:'PLN', CZ:'CZK', HU:'HUF', RO:'RON', BG:'BGN', IS:'ISK',
  TR:'TRY', UA:'UAH', MX:'MXN', BR:'BRL', AR:'ARS', CL:'CLP', CO:'COP', PE:'PEN', UY:'UYU', JP:'JPY', KR:'KRW', CN:'CNY', HK:'HKD', TW:'TWD', IN:'INR', ID:'IDR', MY:'MYR',
  PH:'PHP', SG:'SGD', TH:'THB', VN:'VND', LK:'LKR', AE:'AED', SA:'SAR', QA:'QAR', IL:'ILS', JO:'JOD', EG:'EGP', MA:'MAD', NG:'NGN', KE:'KES', TZ:'TZS', ZA:'ZAR', RS:'RSD' };
export function guessCurrency(lang){
  const region = String(lang || '').split(/[-_]/).find((x, i) => i > 0 && /^[A-Za-z]{2}$/.test(x))?.toUpperCase();
  if(EURO.includes(region)) return 'EUR';
  return REGION_CUR[region] || 'GBP';
}
const names = (() => { try{ return new Intl.DisplayNames(['en-GB'], { type:'currency' }); }catch(e){ return null; } })();
export const currencyName = cur => names?.of(cur) || cur;
/* <option>s for a currency picker: "GBP · British Pound", plus the current value if it's not in the list */
export function currencyOptions(selected = 'GBP'){
  const list = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
  return list.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c} · ${esc(currencyName(c))}</option>`).join('');
}
/* Digits after the point: 2 for most, 0 for yen, won, forint… Amounts are always stored in hundredths */
export function minorDigits(cur){
  try{ return new Intl.NumberFormat('en-GB',{style:'currency',currency:cur}).resolvedOptions().maximumFractionDigits; }
  catch(e){ return 2; }
}
/* Hundredths → what goes in an amount box: "12.50", or "1500" for yen */
export const plainAmount = (p, cur) => (p/100).toFixed(minorDigits(cur));
/* Smallest amount a share can be, in hundredths: 1 (a penny) or 100 (a whole yen) */
export const minorStep = cur => 10 ** (2 - Math.min(2, minorDigits(cur)));

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
