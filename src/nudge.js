/* Nudging someone who owes you: your phone's share sheet opens with a friendly message and a link,
   so it goes by whatever you already use (WhatsApp, iMessage, email). Remembered on this device. Always asks first */
import { state } from './store.js';
import { money } from './lib/format.js';
import { nudgeText, nudgeKey, nudgeMessage, dueNudges, frequencyMs, FREQUENCIES } from './lib/nudge.js';
import { askConfirm } from './dialogs/confirm.js';
import { personName, hasAccount, isMe, lastActivity } from './selectors.js';
import { inviteLink, groupHref } from './router.js';
import { toast } from './ui.js';

const NUDGED = 'settlr.nudged', PREF = 'settlr.nudges', DISMISSED = 'settlr.nudgesDismissed';
const read = (k, fallback) => { try{ return JSON.parse(localStorage.getItem(k)) ?? fallback; }catch(e){ return fallback; } };
const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ /* private mode: just not remembered */ } };

export const nudgedAt = (gid, pid) => read(NUDGED, {})[nudgeKey(gid, pid)] || 0;
/* "never" (the default), "weekly", "fortnightly" or "monthly": how often the overview lines up who to nudge */
export const nudgePref = () => { const v = read(PREF, 'never'); return v in FREQUENCIES ? v : 'never'; };
export const setNudgePref = v => write(PREF, v in FREQUENCIES ? v : 'never');
export const dismissNudges = () => write(DISMISSED, Date.now());

/* The overview's list: nothing when switched off or put away since the last interval */
export function dueNow(now = Date.now()){
  const pref = nudgePref(), every = frequencyMs(pref);
  if(pref === 'never' || now - read(DISMISSED, 0) < every) return [];
  return dueNudges(state.groups, isMe, { now, nudged: read(NUDGED, {}), lastActivity, every });
}

export async function nudge(g, pid, amount){
  const first = personName(pid).split(' ')[0] || 'there';
  const text = nudgeText(first, money(amount, g.currency), g.name);
  /* Someone with an account opens the group; anyone else gets the invite to join it */
  const url = hasAccount(pid) ? location.origin + location.pathname + groupHref(g) : inviteLink(g);
  /* Nothing goes out until you've seen exactly what it says */
  const message = nudgeMessage(text, url);
  if(!await askConfirm({ title: `Send this nudge to ${first}?`, body: message, confirmLabel: 'Send nudge', danger: false })) return false;
  let sent = false;
  if(navigator.share){
    try{ await navigator.share({ text: message }); sent = true; }
    catch(err){ if(err.name === 'AbortError') return false; }
  }
  if(!sent){
    try{ await navigator.clipboard.writeText(message); toast(`Message copied. Paste it to ${first}.`); }
    catch(e){ window.prompt(`Copy this and send it to ${first}:`, message); }
  }
  const all = read(NUDGED, {}); all[nudgeKey(g.id, pid)] = Date.now(); write(NUDGED, all);
  return true;
}
