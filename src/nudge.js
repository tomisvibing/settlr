/* Nudging someone who owes you. If they have settlr notifications on, they get one; otherwise your
   phone's share sheet opens with a friendly message and a link, so it goes by whatever you already
   use (WhatsApp, iMessage, email). When you last nudged someone is remembered on this device */
import { state } from './store.js';
import { money } from './lib/format.js';
import { nudgeText, nudgeKey, dueNudges } from './lib/nudge.js';
import { personName, hasAccount, isMe, lastActivity, myHandles } from './selectors.js';
import { payLinks } from './lib/paylinks.js';
import { inviteLink, groupHref } from './router.js';
import { toast } from './ui.js';
import { nudgeByPush } from './push.js';

const NUDGED = 'settlr.nudged', PREF = 'settlr.nudges', DISMISSED = 'settlr.nudgesDismissed';
const read = (k, fallback) => { try{ return JSON.parse(localStorage.getItem(k)) ?? fallback; }catch(e){ return fallback; } };
const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ /* private mode: just not remembered */ } };

export const nudgedAt = (gid, pid) => read(NUDGED, {})[nudgeKey(gid, pid)] || 0;
/* "weekly" (the default) or "never": whether the overview lines up who to nudge each week */
export const nudgePref = () => read(PREF, 'weekly');
export const setNudgePref = v => write(PREF, v === 'never' ? 'never' : 'weekly');
export const dismissNudges = () => write(DISMISSED, Date.now());

/* The overview's weekly list: nothing when switched off or put away in the last week */
export function weeklyNudges(now = Date.now()){
  if(nudgePref() === 'never' || now - read(DISMISSED, 0) < 7 * 864e5) return [];
  return dueNudges(state.groups, isMe, { now, nudged: read(NUDGED, {}), lastActivity });
}

/* The share sheet, or the clipboard where there isn't one. After a wait (asking the server first)
   a phone may refuse to open the sheet without a fresh tap, so that case offers a button */
async function share(text, url, first){
  if(navigator.share){
    try{ await navigator.share({ text, url }); return true; }
    catch(err){
      if(err.name === 'AbortError') return false;
      if(err.name === 'NotAllowedError'){ toast(`Send ${first} a nudge?`, { action: 'Share', onAction: () => navigator.share({ text, url }).catch(() => {}) }); return true; }
    }
  }
  try{ await navigator.clipboard.writeText(`${text} ${url}`); toast(`Nudge copied. Paste it to ${first}.`); }
  catch(e){ window.prompt(`Copy this and send it to ${first}:`, `${text} ${url}`); }
  return true;
}

/* Someone with notifications on gets one straight away; anyone else gets a message from your phone */
export async function nudge(g, pid, amount){
  const first = personName(pid).split(' ')[0] || 'there';
  let done = false;
  if(hasAccount(pid)){
    const r = await nudgeByPush(g.id, pid);
    if(r.recent){ toast(`You’ve already nudged ${first} today.`); return false; }
    if(r.sent){ toast(`Nudged ${first}. They’ll get a notification.`); done = true; }
  }
  if(!done){
    const text = nudgeText(first, money(amount, g.currency), g.name, payLinks(myHandles(), amount, g.currency, g.name)[0]);
    /* Someone with an account opens the group; anyone else gets the invite to join it */
    const url = hasAccount(pid) ? location.origin + location.pathname + groupHref(g) : inviteLink(g);
    if(!await share(text, url, first)) return false;
  }
  const all = read(NUDGED, {}); all[nudgeKey(g.id, pid)] = Date.now(); write(NUDGED, all);
  return true;
}
