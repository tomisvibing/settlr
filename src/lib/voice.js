import { toPence, isoDate } from './format.js';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const AMOUNT = [
  /[£$€]\s?(\d+(?:[.,]\d{1,2})?)/,
  /(\d+(?:[.,]\d{1,2})?)\s?(?:pounds?|quid|dollars?|bucks|euros?)\b/i,
  /\b(\d+(?:[.,]\d{1,2})?)\b/,
];
const DATE_WORDS = new RegExp('\\b(yesterday|today|tonight|last night|this (?:morning|afternoon|evening)|(?:on |last )?(?:' + DAYS.join('|') + '))\\b', 'ig');

/* Lightweight, local heuristics: no server round trip, and every field stays editable before saving.
   The voice screen asks for "what, how much, who paid, who for" (e.g. "Dinner at Nando's, £37, I paid,
   split with Sam and Bob"), but people tell stories too ("Yesterday we went for dinner at Nando's and it
   cost me 37 quid"), so the description is only the first phrase, never the whole sentence.
   members is [{ id, name }]; meId is the speaker's own member id; now is injectable for tests. */
export function parseVoiceExpense(text, members, now = new Date(), meId = null){
  const said = ' ' + text.trim() + ' ';
  const result = {};

  /* amount: prefer an explicit currency mark, then a currency word, then any bare number */
  const am = AMOUNT.map(re => said.match(re)).find(Boolean);
  if(am) result.amount = toPence(am[1].replace(',', '.'));
  /* the currency, when it was said: "£37", "20 quid", "15 dollars", "€12", "30 euros", "50 francs" */
  const cm = said.match(/£|\b(?:pounds?|quid)\b|\$|\b(?:dollars?|bucks)\b|€|\beuros?\b|\b(?:swiss\s+)?francs?\b|\byen\b/i);
  if(cm){
    const w = cm[0].toLowerCase();
    result.currency = w === '£' || /pound|quid/.test(w) ? 'GBP' : w === '$' || /dollar|buck/.test(w) ? 'USD' : w === '€' || /euro/.test(w) ? 'EUR' : /franc/.test(w) ? 'CHF' : 'JPY';
  }

  /* date: yesterday / today / a weekday name */
  let dm;
  if(/\byesterday\b|\blast night\b/i.test(said)){ const d = new Date(now); d.setDate(d.getDate() - 1); result.date = isoDate(d); }
  else if(/\btoday\b|\btonight\b|\bthis (morning|afternoon|evening)\b/i.test(said)) result.date = isoDate(now);
  else if((dm = said.match(new RegExp('\\b(last\\s+)?(' + DAYS.join('|') + ')\\b', 'i')))){
    const idx = DAYS.indexOf(dm[2].toLowerCase()), d = new Date(now);
    let diff = (d.getDay() - idx + 7) % 7; if(diff === 0 && dm[1]) diff = 7;
    d.setDate(d.getDate() - diff); result.date = isoDate(d);
  }

  /* who paid: "Sam paid", "paid by Sam", or me: "I paid", "paid by me", "it cost me", "I got it" */
  for(const { id, name } of members){
    const n = escapeRe(name);
    if(new RegExp(`\\b${n}\\s+paid\\b|\\bpaid\\s+by\\s+${n}\\b`, 'i').test(said)) result.paidBy = id;
  }
  if(!result.paidBy && meId && /\bi\s+paid\b|\bpaid\s+by\s+me\b|\bcost\s+me\b|\bi\s+(got|covered)\s+(it|this|that)\b|\bon\s+me\b/i.test(said)) result.paidBy = meId;

  /* who it's for: everyone, or the people named after "split", "between", "with", "just" or "for" */
  if(/\b(split|shared?)\s+(it\s+)?(equally|evenly|even)\b|\bequal(ly)?\s+split\b|\b(everyone|everybody|all of us|us all)\b/i.test(said)) result.mode = 'equal';
  const sm = said.match(/\b(split|shared?)\b(.*)$/i) || said.match(/\b(between|with|just|only)\b(.*)$/i);
  if(sm){
    const kw = sm[1].toLowerCase(), tail = sm[2];
    const named = members.filter(({ id, name }) => id !== meId && new RegExp('\\b' + escapeRe(name) + '\\b', 'i').test(tail));
    /* "with Sam" means me and Sam; "between Sam and Bob" means just them unless I'm named too */
    const withMe = meId && (kw === 'with' || /^\s*(it\s+)?with\b/i.test(tail) || /\b(me|myself|us)\b/i.test(tail));
    const subset = [...(withMe ? [meId] : []), ...named.map(m => m.id)];
    if(named.length && subset.length >= 2){ result.mode = 'equal'; result.subset = subset; }
  }

  result.desc = describe(said, members) || text.trim();
  return result;
}

/* The description: the first real phrase, stopping at a comma or where the amount, payer or split starts */
function describe(said, members){
  const names = members.map(m => escapeRe(m.name)).join('|') || '(?!)';
  const boundary = new RegExp([
    '[,.;!?]',
    ...AMOUNT.map(re => re.source.replace(/\((?!\?)/g, '(?:')),
    '\\b(?:and\\s+)?(?:it\\s+|that\\s+|which\\s+)?(?:cost|costs|came\\s+to|was)\\b',
    `\\b(?:and\\s+)?(?:i|we|${names})\\s+paid\\b`, '\\bpaid\\b',
    "\\b(?:and\\s+)?(?:it'?s\\s+|it\\s+is\\s+|we\\s+)?(?:split|shared)\\b", '\\bbetween\\b', '\\bjust\\b',
    `\\b(?:for|with)\\s+(?:everyone|everybody|all\\s+of\\s+us|us\\s+all|me|us|${names})\\b`,
    '\\band\\s+(?:i|we|it)\\b',
  ].join('|'), 'ig');
  const pieces = said.replace(DATE_WORDS, ' ').split(boundary).filter(p => p !== undefined);
  for(const piece of pieces){
    const d = tidy(piece);
    /* skip scraps that are only a name or a filler word ("Sam", "for the") */
    if(d && !new RegExp(`^(?:${names}|me|us|it|each|all)$`, 'i').test(d)) return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return '';
}

/* Strip the story around the thing itself: "so we went out for dinner at Nando's" → "dinner at Nando's" */
const LEAD = /^(?:so|um+|uh+|er+m?|ok(?:ay)?|right|well|and|then|we|i|just|basically|pay(?:ing)?\s+for|went(?:\s+out)?\s+(?:for|to)|had|got|bought|grabbed|did|paid\s+for|for|on|at|the|a|an|some|our|my)\b\s*/i;
function tidy(piece){
  let d = piece.replace(/\s+/g, ' ').trim(), prev;
  do{ prev = d; d = d.replace(LEAD, '').trim(); } while(d !== prev && d);
  return d.replace(/\s+(?:on|at|for|with|and|the|to)$/i, '').replace(/[.,;:!?'"]+$/, '').trim();
}
