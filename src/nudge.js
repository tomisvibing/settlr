/* Nudging someone who owes you. You always see the message and say yes first. If they have settlr
   notifications on, they get one; otherwise your phone's share sheet opens with the message, so it
   goes by whatever you already use (WhatsApp, iMessage, email). Remembered on this device */
import { state } from './store.js';
import { money } from './lib/format.js';
import { nudgeText, nudgeKey, nudgeMessage, dueNudges, frequencyMs, FREQUENCIES } from './lib/nudge.js';
import { askConfirm } from './dialogs/confirm.js';
import { personName, hasAccount, isMe, lastActivity, myHandles } from './selectors.js';
import { payLinks } from './lib/paylinks.js';
import { inviteLink, groupHref } from './router.js';
import { toast } from './ui.js';
import { nudgeByPush } from './push.js';

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

/* The share sheet, or the clipboard where there isn't one. After a wait (the confirm sheet, asking
   the server) a phone may refuse to open the sheet without a fresh tap, so that case offers a button */
async function share(message, first){
  if(navigator.share){
    try{ await navigator.share({ text: message }); return true; }
    catch(err){
      if(err.name === 'AbortError') return false;
      if(err.name === 'NotAllowedError'){ toast(`Send ${first} the nudge?`, { action: 'Share', onAction: () => navigator.share({ text: message }).catch(() => {}) }); return true; }
    }
  }
  try{ await navigator.clipboard.writeText(message); toast(`Message copied. Paste it to ${first}.`); }
  catch(e){ window.prompt(`Copy this and send it to ${first}:`, message); }
  return true;
}

/* After you say yes: someone with notifications on gets one straight away; anyone else gets the
   message from your phone */
export async function nudge(g, pid, amount){
  const first = personName(pid).split(' ')[0] || 'there';
  const text = nudgeText(first, money(amount, g.currency), g.name, payLinks(myHandles(), amount, g.currency, g.name)[0]);
  /* Someone with an account opens the group; anyone else gets the invite to join it */
  const url = hasAccount(pid) ? location.origin + location.pathname + groupHref(g) : inviteLink(g);
  /* Nothing goes out until you've seen exactly what it says */
  const message = nudgeMessage(text, url);
  if(!await askConfirm({ title: `Send this nudge to ${first}?`, body: message, confirmLabel: 'Send nudge', danger: false })) return false;
  let done = false;
  if(hasAccount(pid)){
    const r = await nudgeByPush(g.id, pid);
    if(r.recent){ toast(`You’ve already nudged ${first} today.`); return false; }
    if(r.sent){ toast(`Nudged ${first}. They’ll get a notification.`); done = true; }
  }
  if(!done && !await share(message, first)) return false;
  const all = read(NUDGED, {}); all[nudgeKey(g.id, pid)] = Date.now(); write(NUDGED, all);
  return true;
}
