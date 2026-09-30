import { sb } from './supabase.js';
import { session } from './store.js';
import { accountPhoto } from './lib/avatar.js';
import { reportError } from './monitoring.js';

/* Share my Google photo with the people in my groups: on sign-in, and after joining a group
   (a claimed placeholder becomes me). Best effort: without it they see my initial. */
export function syncMyPhoto(){
  const url = accountPhoto(session?.user);
  if(!url) return;
  sb.rpc('set_my_avatar', { url }).then(({ error }) => { if(error) reportError(error, 'set_my_avatar'); }, () => {});
}

/* A photo that won't load (expired link, offline) is removed, leaving the initial underneath */
export function initPhotoFallback(){
  document.addEventListener('error', e => { if(e.target instanceof HTMLImageElement && e.target.parentElement?.classList.contains('av')) e.target.remove(); }, true);
}
