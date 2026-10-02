/* Settings kept on this device: your home currency, which is what a new expense or group starts in */
import { guessCurrency, CURRENCIES } from './lib/format.js';

const HOME = 'settlr.homeCurrency';
export const homeCurrency = () => {
  try{ const v = localStorage.getItem(HOME); if(v && /^[A-Z]{3}$/.test(v)) return v; }catch(e){ /* private mode */ }
  return guessCurrency(navigator.language);
};
export const setHomeCurrency = v => {
  if(!CURRENCIES.includes(v)) return;
  try{ localStorage.setItem(HOME, v); }catch(e){ /* private mode: just not remembered */ }
};

/* Settle-up as the fewest payments (the default), or as who owes whom. Only changes the list on a group's page */
const SIMPLIFY = 'settlr.simplifyDebts';
export const simplifyDebts = () => { try{ return localStorage.getItem(SIMPLIFY) !== 'off'; }catch(e){ return true; } };
export const setSimplifyDebts = on => { try{ localStorage.setItem(SIMPLIFY, on ? 'on' : 'off'); }catch(e){ /* private mode: just not remembered */ } };
