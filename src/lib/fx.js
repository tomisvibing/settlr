/* Currency conversion maths for entries in a currency other than the group's (tested in test/fx.test.js).
   Amounts are hundredths throughout; a rate is how many of the group's currency one unit buys. */
import { minorStep } from './format.js';

/* The currencies the free European Central Bank rates (Frankfurter) cover. Others need a typed rate. */
export const FETCHABLE = new Set(['AUD','BGN','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD','HUF','IDR','ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN','RON','SEK','SGD','THB','TRY','USD','ZAR']);
export const canFetch = (from, to) => FETCHABLE.has(from) && FETCHABLE.has(to);

/* An amount in hundredths of `from`, in hundredths of the group's currency, rounded to what it can
   hold (whole yen for a yen group) */
export function convert(amount, rate, groupCur){
  if(!(amount > 0) || !(rate > 0)) return 0;
  const step = minorStep(groupCur);
  return Math.max(step, Math.round(amount * rate / step) * step);
}

/* A typed rate: "1.0622", "1,0622" → 1.0622; anything else → NaN */
export function parseRate(v){
  const s = String(v ?? '').trim().replace(',', '.');
  if(!/^\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n > 0 ? n : NaN;
}

/* A rate for display and editing: enough significant figures to be exact, no trailing noise */
export const formatRate = rate => Number(rate.toPrecision(6)).toString();
