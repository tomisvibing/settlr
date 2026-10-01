/* Nudging someone who owes you: your phone's share sheet opens with a friendly message and a link,
   so it goes by whatever you already use (WhatsApp, iMessage, email). Remembered on this device */
import { state } from './store.js';
import { money } from './lib/format.js';
import { nudgeText, nudgeKey, dueNudges } from './lib/nudge.js';
import { personName, hasAccount, isMe, lastActivity } from './selectors.js';
import { inviteLink, groupHref } from './router.js';
import { toast } from './ui.js';

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

export async function nudge(g, pid, amount){
  const first = personName(pid).split(' ')[0] || 'there';
  const text = nudgeText(first, money(amount, g.currency), g.name);
  /* Someone with an account opens the group; anyone else gets the invite to join it */
  const url = hasAccount(pid) ? location.origin + location.pathname + groupHref(g) : inviteLink(g);
  let sent = false;
  if(navigator.share){
    try{ await navigator.share({ text, url }); sent = true; }
    catch(err){ if(err.name === 'AbortError') return false; }
  }
  if(!sent){
    try{ await navigator.clipboard.writeText(`${text} ${url}`); toast(`Nudge copied. Paste it to ${first}.`); }
    catch(e){ window.prompt(`Copy this and send it to ${first}:`, `${text} ${url}`); }
  }
  const all = read(NUDGED, {}); all[nudgeKey(g.id, pid)] = Date.now(); write(NUDGED, all);
  return true;
}
