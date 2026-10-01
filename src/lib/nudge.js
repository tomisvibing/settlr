/* Who to nudge, and what to say (tested in test/nudge.test.js). Pure: give it the groups and the
   nudges already sent. settlr doesn't message anyone itself; it lines people up and you send the
   nudge from your phone */
import { balances, settlements } from './ledger.js';

export const WEEK = 7 * 864e5;
/* How often to be reminded, in days; "never" is the default, so nobody is nagged unasked */
export const FREQUENCIES = { weekly: 7, fortnightly: 14, monthly: 30 };
export const frequencyMs = f => (FREQUENCIES[f] || 7) * 864e5;
const key = (gid, pid) => `${gid}:${pid}`;

/* Everyone who owes you in an active group that's been quiet for a week, and who you haven't
   nudged in the last week. Biggest first */
export function dueNudges(groups, isMe, { now = Date.now(), nudged = {}, lastActivity, every = WEEK }){
  const due = [];
  for(const g of groups){
    if(g.archivedAt || now - lastActivity(g) < every) continue;
    for(const p of settlements(balances(g))){
      if(!isMe(p.to) || isMe(p.from)) continue;
      if(now - (nudged[key(g.id, p.from)] || 0) < every) continue;
      due.push({ g, pid: p.from, amount: p.amount });
    }
  }
  return due.sort((a, c) => c.amount - a.amount);
}

export const nudgeKey = key;

export function nudgeText(firstName, amount, groupName){
  return `Hi ${firstName}! A friendly nudge from settlr: you owe me ${amount} for ${groupName}. No rush, but here’s the link when you’re ready.`;
}
/* The whole message as sent: the link goes inside the text, because many apps drop a share's text
   when it comes with a separate link, leaving just the link */
export const nudgeMessage = (text, url) => `${text} ${url}`;
