import { esc, money, initial } from '../lib/format.js';
import { meIn, personName, personPhoto, isMe } from '../selectors.js';

/* A stable tint per person or group, so the same face always has the same colour */
export function tintOf(id){
  let h = 0;
  for(const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 't' + (1 + Math.abs(h) % 6);
}
/* The initial sits under the photo, so a photo that fails to load (see main.js) leaves the initial */
export function avatar(pid, size = ''){
  const photo = personPhoto(pid);
  return `<span class="av ${size} ${tintOf(pid)}" aria-hidden="true">${esc(initial(personName(pid)))}${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async">` : ''}</span>`;
}
export const groupTile = (g, size = '') =>
  `<span class="tile ${size} ${tintOf(g.id)}" aria-hidden="true">${esc(initial(g.name))}</span>`;

const svg = (d, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  invite: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  cog: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.7),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2),
  backspace: svg('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-5 6M12 9l5 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2),
  clip: svg('<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>'),
  comment: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
  restore: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

/* A section as a folder: its name on a tab, any buttons beside the tab, the content inside.
   id names the section (#<id>Sec) and its heading (#<id>Head), so the group page can jump to it */
export const folder = ({ id, title, actions = '', body }) =>
  `<section class="section" id="${id}Sec" aria-labelledby="${id}Head">
    <div class="section-head"><h2 id="${id}Head">${title}</h2>${actions}</div>
    <div class="fold">${body}</div>
  </section>`;

/* The buttons a row reveals when swiped left (touch only, see swipe.js): [action, label, icon, 'del'?].
   Hidden from screen readers and the tab order: the same actions are in the edit sheet. */
export function swipeButtons(buttons, id, gid = ''){
  const attrs = `data-id="${id}"${gid ? ` data-group="${gid}"` : ''} tabindex="-1"`;
  return `<span class="swipe-acts" aria-hidden="true">${buttons.map(([action, label, ic, kind = '']) =>
    `<button type="button" class="sa ${kind}" data-action="${action}" ${attrs}>${ic}${label}</button>`).join('')}</span>`;
}
/* The usual pair: Edit and Delete */
export const swipeActs = (editAction, delAction, id, gid = '') =>
  swipeButtons([[editAction, 'Edit', icon.edit], [delAction, 'Delete', icon.trash, 'del']], id, gid);

/* What an entry did to my balance: + means I'm owed more, − means I owe more */
export function myLine(e, g){
  const me = meIn(g); if(!me) return '';
  const v = (e.paidBy === me ? e.amount : 0) - (e.splits[me] || 0);
  if(!v) return '';
  const isPay = e.type === 'payment';
  const word = v > 0 ? (isPay ? 'you paid' : 'you lent') : (isPay ? 'you received' : 'you borrowed');
  return `<span class="r-mine ${v>0?'pos':'neg'}">${word} ${money(Math.abs(v), g.currency)}</span>`;
}
const who = pid => isMe(pid) ? 'You' : esc(personName(pid));
export function entryMeta(e){
  const n = Object.keys(e.splits).length;
  if(e.type === 'payment') return `${who(e.paidBy)} paid ${isMe(Object.keys(e.splits)[0]) ? 'you' : esc(personName(Object.keys(e.splits)[0]))}`;
  return `${who(e.paidBy)} paid · ${e.splitMode==='exact'?'split by amount':e.splitMode==='shares'?'split by shares':`split ${n} ${n===1?'way':'ways'}`}`;
}
