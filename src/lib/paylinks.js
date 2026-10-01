/* Links that open a payment app with the amount filled in (tested in test/paylinks.test.js).
   Monzo takes pounds only; PayPal takes any currency it supports; Revolut's public links can't
   carry an amount, so that one opens the person's page and you type it */
import { plainAmount } from './format.js';

export const PAY_APPS = [
  { key: 'monzo', name: 'Monzo', host: 'monzo.me' },
  { key: 'paypal', name: 'PayPal', host: 'paypal.me' },
  { key: 'revolut', name: 'Revolut', host: 'revolut.me' },
];
const HANDLE = /^[A-Za-z0-9._-]{1,40}$/;

/* What someone typed or pasted ("tom", "@tom", "https://monzo.me/tom/10") to a bare username, or
   null when it isn't one */
export function cleanHandle(input, host){
  let s = String(input || '').trim();
  if(!s) return '';
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if(s.toLowerCase().startsWith(host + '/')) s = s.slice(host.length + 1);
  s = s.replace(/^@/, '').split(/[/?#]/)[0];
  return HANDLE.test(s) ? s : null;
}

/* Every link for one payment: [{ key, name, url, filled }] where filled says whether the amount
   comes with it */
export function payLinks(handles, amount, currency, note = ''){
  if(!handles) return [];
  const out = [], value = plainAmount(amount, currency);
  if(handles.monzo && currency === 'GBP'){
    out.push({ key: 'monzo', name: 'Monzo', filled: true, url: `https://monzo.me/${encodeURIComponent(handles.monzo)}/${value}${note ? `?d=${encodeURIComponent(note.slice(0, 40))}` : ''}` });
  }
  if(handles.paypal) out.push({ key: 'paypal', name: 'PayPal', filled: true, url: `https://paypal.me/${encodeURIComponent(handles.paypal)}/${value}${currency}` });
  if(handles.revolut) out.push({ key: 'revolut', name: 'Revolut', filled: false, url: `https://revolut.me/${encodeURIComponent(handles.revolut)}` });
  return out;
}
