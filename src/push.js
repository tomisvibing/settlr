/* Push notifications on this phone or browser: a Sunday summary of who owes what, and a ping when
   someone nudges you. The push Edge Function sends them (supabase/functions/push) */
import { sb } from './supabase.js';
import { reportError } from './monitoring.js';

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export function initServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(err => reportError(err, 'service worker'));
  /* A tapped notification asks an open settlr to go to its page */
  navigator.serviceWorker.addEventListener('message', ev => { if(ev.data?.go) location.href = ev.data.go; });
}

/* What this device can do: 'ok', 'install' (an iPhone needs settlr on the Home Screen first),
   'blocked' (turned off in settings) or 'unsupported' */
export function pushSupport(){
  if(ios() && !standalone()) return 'install';
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if(Notification.permission === 'denied') return 'blocked';
  return 'ok';
}

async function currentSub(){
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
/* Whether this device is subscribed. Cached for drawing the You page, which can't wait */
let known = null;
export const pushKnown = () => known;
export async function checkPush(){
  try{ known = pushSupport() === 'ok' && Notification.permission === 'granted' && !!(await currentSub()); }
  catch(e){ known = false; }
  return known;
}

const b64ToBytes = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };

/* Ask, subscribe and save. Returns '' on success, or a sentence saying why not */
export async function enablePush(){
  const support = pushSupport();
  if(support === 'install') return 'On an iPhone, add settlr to your Home Screen first (Share, then Add to Home Screen), then turn this on there.';
  if(support === 'blocked') return 'Notifications are blocked for settlr. Allow them in your browser or phone settings, then try again.';
  if(support !== 'ok') return 'This browser can’t show notifications.';
  if(await Notification.requestPermission() !== 'granted') return 'Notifications weren’t allowed, so they’re still off.';
  try{
    const reg = await navigator.serviceWorker.ready;
    const { data, error } = await sb.functions.invoke('push', { body: { type: 'key' } });
    if(error || !data?.publicKey) throw error || new Error('No push key');
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
    const { endpoint, keys } = sub.toJSON();
    /* Signed in as someone else on this device before: their row goes, this one's added */
    await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
    const { error: saveErr } = await sb.from('push_subscriptions').insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
    if(saveErr) throw saveErr;
    known = true;
    return '';
  }catch(err){
    reportError(err, 'enable push');
    return 'Couldn’t switch notifications on. Check your connection and try again.';
  }
}
export async function disablePush(){
  try{
    const sub = await currentSub();
    if(sub){ await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
  }catch(err){ reportError(err, 'disable push'); }
  known = false;
}

/* Tell someone you've nudged them, by notification. Returns true if it reached a device of theirs */
export async function nudgeByPush(groupId, personId){
  try{
    const { data, error } = await sb.functions.invoke('push', { body: { type: 'nudge', group_id: groupId, person_id: personId } });
    if(error) throw error;
    return { sent: data?.sent > 0, recent: data?.reason === 'recent' };
  }catch(err){
    reportError(err, 'nudge push');
    return { sent: false };
  }
}
