/* One overall figure across groups in different currencies (tested in test/overall.test.js).
   `totals` is [[currency, hundredths]]; `rates` maps a currency to what one unit is worth in `home`
   (a missing rate means it couldn't be looked up). Amounts are hundredths throughout. */
import { minorStep } from './format.js';

export function overall(totals, rates, home){
  let sum = 0; const missing = [];
  for(const [cur, v] of totals){
    if(cur === home) sum += v;
    else if(rates[cur] > 0) sum += v * rates[cur];
    else missing.push(cur);
  }
  const step = minorStep(home);
  return { total: Math.round(sum / step) * step, missing };
}

/* Worth saying only when balances sit in more than one currency; one currency is already on the page */
export const needsOverall = totals => new Set(totals.map(([c]) => c)).size > 1;
