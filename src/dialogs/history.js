/* A group's History sheet: who added, changed or deleted what, with Restore on deleted entries */
import { sb } from '../supabase.js';
import { session } from '../store.js';
import { $, esc, money, ago } from '../lib/format.js';
import { describe } from '../lib/history.js';
import { group, personName, isArchived } from '../selectors.js';
import { refresh } from '../data.js';
import { toast } from '../ui.js';
import { icon } from '../views/shared.js';
import { dlg, setDraft, openDialog, describeError } from './dialog.js';

const time = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export async function openHistory(){
  const g = group(); if(!g) return;
  setDraft({ history: g.id });
  openDialog(`
    <div class="sheet-head"><h2 style="flex:1">History</h2><button type="button" class="iconbtn" data-action="close" aria-label="Close">${icon.close}</button></div>
    <p class="hint" style="margin:-6px 0 0">Everything added, changed or deleted in ${esc(g.name)}. Deleted entries can be brought back.</p>
    <div class="card" id="histList"><p class="none">Loading…</p></div>`, () => false);
  const { data, error } = await sb.from('activity_log').select('*').eq('group_id', g.id).order('created_at', { ascending: false }).limit(200);
  const box = $('#histList'); if(!box || !dlg.open) return;
  if(error){ box.innerHTML = `<p class="none">Couldn’t load the history: ${esc(error.message)}</p>`; return; }
  if(!data.length){ box.innerHTML = '<p class="none">Nothing yet. Changes show up here from now on.</p>'; return; }
  const frozen = isArchived(g);
  const ctx = {
    name: pid => pid ? personName(pid) : 'someone',
    money: (v, cur = g.currency) => money(v, cur),
    isMe: uid => uid && uid === session?.user?.id,
    exists: eid => g.expenses.some(e => e.id === eid),
  };
  box.innerHTML = `<ul class="rows history">${data.map(ev => {
    const { text, restore } = describe(ev, ctx);
    return `<li><div class="row">
      <span class="r-main"><span class="hist-text">${esc(text)}</span><span class="r-meta">${ago(new Date(ev.created_at).getTime())} · ${time(ev.created_at)}</span></span>
      ${restore && !frozen ? `<button type="button" class="btn small" data-action="restore-entry" data-id="${esc(restore)}">Restore</button>` : ''}
    </div></li>`;
  }).join('')}</ul>`;
}

/* Bring a deleted entry back (from the Undo toast or the History sheet) */
export async function restoreEntry(eid){
  const { error } = await sb.rpc('restore_deleted_expense', { eid });
  if(error){ toast(describeError(error)); return; }
  await refresh();
  toast('Brought it back.');
  if(dlg.open && $('#histList')) openHistory();
}
