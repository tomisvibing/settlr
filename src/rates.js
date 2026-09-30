/* Exchange rates from Frankfurter (European Central Bank daily rates, free, no key). Only the two
   currency codes and a date are sent. Weekends and holidays get the last working day's rate. */
import { canFetch } from './lib/fx.js';
import { today } from './lib/format.js';

const cache = new Map();
const HOSTS = [
  (from, to, day) => `https://api.frankfurter.dev/v1/${day}?base=${from}&symbols=${to}`,
  (from, to, day) => `https://api.frankfurter.app/${day}?from=${from}&to=${to}`,
];

/* { rate, date } for 1 `from` in `to` on `date` (or the latest, for today and future dates); null if
   the pair isn't covered or the service can't be reached */
export async function fetchRate(from, to, date){
  if(from === to) return { rate: 1, date };
  if(!canFetch(from, to)) return null;
  const day = !date || date >= today() ? 'latest' : date;
  const key = `${from}>${to}@${day}`;
  if(cache.has(key)) return cache.get(key);
  for(const url of HOSTS){
    try{
      const res = await fetch(url(from, to, day), { signal: AbortSignal.timeout?.(6000) });
      if(!res.ok) continue;
      const body = await res.json();
      const rate = body?.rates?.[to];
      if(rate > 0){ const out = { rate, date: body.date || day }; cache.set(key, out); return out; }
    }catch{ /* try the next host */ }
  }
  return null;
}
