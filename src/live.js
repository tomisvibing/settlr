/* Live updates: Supabase Realtime tells us when anything we can see changes (other people's
   expenses, a new member, a renamed group) and we reload. Realtime applies the same security
   rules as a normal read, so we only hear about our own groups. */
import { sb } from './supabase.js';
import { reportError } from './monitoring.js';
import { dlg } from './dialogs/dialog.js';

const TABLES = ['groups', 'group_members', 'people', 'expenses', 'expense_splits', 'payments'];
/* One save touches several rows (an expense and its splits); wait for the burst to finish */
const SETTLE_MS = 400;

let channel = null;
let timer = null;
let pending = false;
let reload = null;

/* Reload now, unless a sheet is open: then wait until it closes, so nothing jumps under someone's thumb */
function flush(){
  timer = null;
  if(dlg.open || document.querySelector('#confirmDlg[open]')){ pending = true; return; }
  pending = false;
  reload?.();
}
function changed(){
  clearTimeout(timer);
  timer = setTimeout(flush, SETTLE_MS);
}

export function startLive(onChange){
  stopLive();
  reload = onChange;
  let connectedOnce = false;
  channel = sb.channel('settlr-live');
  for(const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed);
  channel.subscribe((status, err) => {
    if(status === 'SUBSCRIBED'){
      /* After a dropped connection, catch up on anything missed while offline */
      if(connectedOnce) changed();
      connectedOnce = true;
    }
    if(status === 'CHANNEL_ERROR' && err) reportError(err, 'realtime');
  });
}

export function stopLive(){
  clearTimeout(timer); timer = null; pending = false; reload = null;
  if(channel){ sb.removeChannel(channel); channel = null; }
}

export function initLive(){
  /* Changes that arrived while a sheet was open */
  dlg.addEventListener('close', () => { if(pending) changed(); });
  document.querySelector('#confirmDlg')?.addEventListener('close', () => { if(pending) changed(); });
}
