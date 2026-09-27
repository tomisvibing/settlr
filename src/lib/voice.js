import { toPence, isoDate } from './format.js';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/* Lightweight, local heuristics — no server round-trip. Every field it fills stays editable before saving. */
/* Turns a spoken sentence into expense fields. members is [{ id, name }]; now is injectable for tests. */
export function parseVoiceExpense(text, members, now = new Date()){
  let t = ' ' + text.trim() + ' ';
  const result = {};

  /* amount: prefer an explicit currency mark, then a currency word, then any bare number */
  let m = t.match(/[£$€]\s?(\d+(?:[.,]\d{1,2})?)/)
    || t.match(/(\d+(?:[.,]\d{1,2})?)\s?(pounds?|quid|dollars?|bucks|euros?)\b/i)
    || t.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);
  if(m){ result.amount = toPence(m[1].replace(',','.')); t = t.replace(m[0], ' '); }

  /* date: yesterday / today / a weekday name */
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  let dm;
  if(/\byesterday\b/i.test(t)){ const d = new Date(now); d.setDate(d.getDate()-1); result.date = isoDate(d); t = t.replace(/\byesterday\b/i,' '); }
  else if(/\btoday\b|\btonight\b|\bthis evening\b/i.test(t)){ result.date = isoDate(now); t = t.replace(/\btoday\b|\btonight\b|\bthis evening\b/i,' '); }
  else if((dm = t.match(new RegExp('\\b(last\\s+)?(' + days.join('|') + ')\\b','i')))){
    const idx = days.indexOf(dm[2].toLowerCase()), d = new Date(now);
    let diff = (d.getDay() - idx + 7) % 7; if(diff === 0 && dm[1]) diff = 7;
    d.setDate(d.getDate() - diff); result.date = isoDate(d); t = t.replace(dm[0], ' ');
  }

  /* who paid: "<name> paid" */
  members.forEach(({ id, name }) => {
    const re = new RegExp('\\b' + escapeRe(name) + '\\s+paid\\b','i');
    if(re.test(t)){ result.paidBy = id; t = t.replace(re, ' '); }
  });

  /* split: "split equally", or naming a subset ("between Sam and Alex", "just me and Sam") */
  if(/\bsplit(ting)?\s+(it\s+)?(equally|evenly|even)\b/i.test(t) || /\bequal(ly)?\s+split\b/i.test(t)){
    result.mode = 'equal';
    t = t.replace(/\bsplit(ting)?\s+(it\s+)?(equally|evenly|even)\b/i,' ').replace(/\bequal(ly)?\s+split\b/i,' ');
  }
  const named = members.filter(({ name }) => new RegExp('\\b' + escapeRe(name) + '\\b','i').test(t));
  if(/\bbetween\b|\bjust\b|\bonly\b/i.test(t) && named.length >= 2){
    result.mode = 'equal'; result.subset = named.map(m => m.id);
    const names = named.map(m => escapeRe(m.name)).join('|');
    t = t.replace(new RegExp('\\b(between|just|only)\\b(\\s+me\\b)?(\\s*(,|and|&)?\\s*(' + names + '))+','ig'), ' ');
  }

  /* whatever's left becomes the description */
  let desc = t.replace(/\s+/g,' ').trim()
    .replace(/^(for|the|a|an)\s+/i,'')
    .replace(/^[,\s]+|[,\s]+$/g,'')
    .replace(/\s+(on|at|for|with|and)$/i,'')
    .replace(/[.,;:!?]+$/,'');
  result.desc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : text.trim();
  return result;
}
