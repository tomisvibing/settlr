/* Today's rates into your home currency, looked up once per currency and kept. `rates` holds a number,
   or null where there isn't a rate. `load` fetches whatever's missing and calls `done` when it's in;
   it returns true while it's still waiting */
import { fetchRate } from './rates.js';
import { homeCurrency } from './prefs.js';

export const rates = {};
export function load(currencies, done){
  const home = homeCurrency(), todo = [...new Set(currencies)].filter(c => c !== home && !(c in rates));
  if(!todo.length) return false;
  todo.forEach(c => { rates[c] = null; });
  Promise.all(todo.map(async c => { rates[c] = (await fetchRate(c, home))?.rate ?? null; })).then(done);
  return true;
}
