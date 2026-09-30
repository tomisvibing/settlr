import { sb } from './supabase.js';
import { session, setSession, setMyPersonId, resetState, PENDING_JOIN_KEY } from './store.js';
import { $, esc } from './lib/format.js';
import { loadAllData, refreshQuietly } from './data.js';
import { startLive, stopLive } from './live.js';
import { parseRoute, render } from './router.js';
import { closeDialog } from './dialogs/dialog.js';
import { reportError, setMonitoringUser } from './monitoring.js';
import { initSignIn, resumeSignIn } from './signin.js';
import { nameFromEmail } from './lib/signin.js';
import { syncMyPhoto } from './photo.js';
import { openProfile } from './dialogs/account.js';
import { renderSkeleton } from './views/skeleton.js';

async function ensureMyPerson(){
  const uid = session.user.id;
  const name = session.user.user_metadata?.full_name || nameFromEmail(session.user.email);
  /* ignoreDuplicates: create my contact once (race-safe) without overwriting a name I've since changed */
  const { error } = await sb.from('people').upsert({ owner_id: uid, user_id: uid, name }, { onConflict: 'owner_id,user_id', ignoreDuplicates: true });
  if(error) throw error;
  const { data, error: se } = await sb.from('people').select('id').eq('owner_id', uid).eq('user_id', uid).single();
  if(se) throw se;
  setMyPersonId(data.id);
  syncMyPhoto();
}
/* An invite link opened while signed out survives the Google round-trip in localStorage */
let authNote = '';
export const setAuthNote = note => { authNote = note; };
export function rememberPendingJoin(){
  const r = parseRoute();
  if(r.name !== 'join') return;
  try{ localStorage.setItem(PENDING_JOIN_KEY, r.code); }catch(e){}
  authNote = authNote || "You've been invited to a group. Sign in to join it.";
  $('#authNote').textContent = authNote;
}
async function onAuthChange(){
  $('#bootScreen').style.display = 'none';
  if(session){
    setMonitoringUser(session.user.id);
    $('#authGate').style.display = 'none';
    $('#appWrap').style.display = '';
    renderSkeleton();
    try{
      await ensureMyPerson();
      await loadAllData();
    }catch(err){
      reportError(err, 'load');
      $('#appWrap').style.display = '';
      $('#app').innerHTML = `<section class="empty"><h1>Couldn't load your data: ${esc(err.message||'unknown error')}</h1><button class="btn primary" data-action="retry">Try again</button></section>`;
      return;
    }
    let pending = null;
    try{ pending = localStorage.getItem(PENDING_JOIN_KEY); localStorage.removeItem(PENDING_JOIN_KEY); }catch(e){}
    if(pending && parseRoute().name !== 'join') history.replaceState(null, '', location.pathname + location.search + '#/join/' + encodeURIComponent(pending));
    $('#appWrap').style.display = '';
    render();
    startLive(refreshQuietly);
    askNameOnce();
  } else {
    stopLive();
    setMyPersonId(null);
    setMonitoringUser(null);
    resetState();
    closeDialog();
    rememberPendingJoin();
    $('#authNote').textContent = authNote;
    authNote = '';
    $('#appWrap').style.display = 'none';
    $('#authGate').style.display = '';
    resumeSignIn();
  }
}
/* onAuthStateChange fires once immediately with the current session, then again
   on sign-in/out/refresh — serialize handling so overlapping fires can't race
   (e.g. both trying to create the "me" contact at once), and skip token refreshes
   and repeat sign-in events for the same user, which don't need a full reload. */
let authChangeChain = Promise.resolve();
let handledUserId;
export function initAuth(){
  sb.auth.onAuthStateChange((event, s) => {
    setSession(s);
    const uid = s?.user?.id || null;
    if(event !== 'INITIAL_SESSION' && uid === handledUserId) return;
    handledUserId = uid;
    authChangeChain = authChangeChain.then(onAuthChange).catch(err => reportError(err, 'auth'));
  });
  initSignIn();
}

/* Email sign-ins start with a name guessed from the address: ask once what people should see instead */
function askNameOnce(){
  const u = session.user;
  if(u.user_metadata?.full_name || parseRoute().name === 'join') return;
  const key = 'settlr:askedName:' + u.id;
  try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }catch(e){ return; }
  openProfile({ welcome: true });
}
