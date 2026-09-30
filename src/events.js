/* Page-wide event delegation: every button carries a data-action */
import { sb } from './supabase.js';
import { state, session, myPersonId } from './store.js';
import { setTheme } from './theme.js';
import { toast, forgetTrigger } from './ui.js';
import { group, personLocked, meIn, isAdmin, canAdmin } from './selectors.js';
import { balances } from './lib/ledger.js';
import { $, money } from './lib/format.js';
import { refresh, lastLoadedAt } from './data.js';
import { render, navigate } from './router.js';
import { rememberPendingJoin } from './auth.js';
import { shareInvite, exportGroupCsv, exportAll } from './share.js';
import { filterActivity } from './views/group.js';
import { dlg, draft, closeDialog, fail, describeError } from './dialogs/dialog.js';
import { openExpense, openAddExpense } from './dialogs/expense.js';
import { openVoiceExpense, abortVoice, finishVoice } from './dialogs/voice.js';
import { openPayment } from './dialogs/payment.js';
import { openSettlement } from './dialogs/settlement.js';
import { openPerson } from './dialogs/person.js';
import { openGroup, addPendingMember, renderMembers } from './dialogs/group.js';
import { openJoinGroup } from './dialogs/join.js';
import { openProfile, openDeleteAccount, signOut } from './dialogs/account.js';
import { askConfirm } from './dialogs/confirm.js';
import { openHistory, restoreEntry } from './dialogs/history.js';
import { removeReceipts, groupReceiptPaths } from './receipts.js';

/* A failed delete shows in the sheet it came from, or as a toast when it came from a swiped row */
const oops = (err, action = 'delete') => { if(dlg.open) fail(describeError(err, action)); else toast(describeError(err, action), { error: true }); };

export function initEvents(){
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-action]'); if(!b || b.disabled) return;
    /* Rows in the Activity tab belong to different groups */
    if(b.dataset.group) state.activeGroupId = b.dataset.group;
    const g = group(), a = b.dataset.action;
    if(a==='new-group') openGroup(true);
    else if(a==='edit-group') openGroup(false);
    else if(a==='join-group') openJoinGroup();
    else if(a==='add-expense') openExpense();
    else if(a==='quick-add') openAddExpense();
    /* The expense typed on the way in travels to the group picked for it */
    else if(a==='pick-group'){ const carry = draft?.pick; state.activeGroupId = b.dataset.id; openExpense(null, carry); }
    else if(a==='pick-new-group') openGroup(true, { carry: draft?.pick });
    else if(a==='voice-expense') openVoiceExpense();
    else if(a==='voice-done') finishVoice();
    else if(a==='voice-type'){ abortVoice(); openExpense(); }
    else if(a==='history') openHistory();
    else if(a==='restore-entry'){ b.disabled = true; await restoreEntry(b.dataset.id); }
    else if(a==='edit-expense') openExpense(b.dataset.id);
    else if(a==='add-payment') openPayment();
    else if(a==='edit-payment') openPayment({id:b.dataset.id});
    else if(a==='settle') openPayment({from:b.dataset.from, to:b.dataset.to, amount:+b.dataset.amount});
    else if(a==='add-person') openPerson();
    else if(a==='edit-person') openPerson(b.dataset.id);
    else if(a==='del-person'){
      if(!personLocked(b.dataset.id) && await askConfirm({ title: 'Delete this person?', body: 'They’re not in any group or settlement, so nothing else changes.', confirmLabel: 'Delete person' })){
        const { error } = await sb.from('people').delete().eq('id', b.dataset.id);
        if(error){ oops(error); return; }
        closeDialog(); await refresh();
      }
    }
    else if(a==='add-settlement') openSettlement();
    else if(a==='edit-settlement') openSettlement({id:b.dataset.id});
    else if(a==='del-settlement'){
      if(await askConfirm({ title: 'Delete this settlement?', body: 'Both people’s balances update straight away.', confirmLabel: 'Delete settlement' })){
        const { error } = await sb.from('payments').delete().eq('id', b.dataset.id);
        if(error){ oops(error); return; }
        closeDialog(); await refresh();
      }
    }
    else if(a==='close') closeDialog();
    else if(a==='skip') $('#app').focus();
    else if(a==='add-member') await addPendingMember();
    else if(a==='invite'){ if(g) await shareInvite(g); }
    else if(a==='export-group'){ if(g) exportGroupCsv(g); }
    else if(a==='export-all') exportAll();
    else if(a==='edit-profile') openProfile();
    else if(a==='delete-account') openDeleteAccount();
    else if(a==='sign-out') await signOut();
    else if(a==='retry') location.reload();
    else if(a==='del-entry'){
      const eid = b.dataset.id, gone = g?.expenses.find(e => e.id === eid), pay = gone?.type === 'payment';
      if(await askConfirm({ title: pay ? 'Delete this payment?' : 'Delete this expense?', body: 'Everyone’s balances in the group update straight away. You can restore it from History.', confirmLabel: pay ? 'Delete payment' : 'Delete expense' })){
        /* The receipt file stays: the history keeps a copy of the entry, so it can be restored */
        const { error } = await sb.from('expenses').delete().eq('id', eid);
        if(error){ oops(error); return; }
        closeDialog(); await refresh();
        toast(`Deleted ${gone?.type === 'payment' ? 'the payment' : `“${gone?.desc || 'entry'}”`}.`, { action: 'Undo', onAction: () => restoreEntry(eid) });
      }
    }
    else if(a==='toggle-admin'){
      ev.preventDefault();
      if(!g || !canAdmin(g)) return;
      const make = !isAdmin(g, b.dataset.pid);
      b.disabled = true;
      const { error } = await sb.rpc('set_group_admin', { gid: g.id, pid: b.dataset.pid, make_admin: make });
      if(error){ b.disabled = false; fail(describeError(error)); return; }
      await refresh(); renderMembers();
    }
    else if(a==='leave-group'){
      if(!g) return;
      const me = meIn(g), bal = me ? (balances(g)[me] || 0) : 0;
      if(bal){ fail(bal < 0 ? `Settle up first: you owe ${money(-bal, g.currency)} in this group.` : `Settle up first: you’re owed ${money(bal, g.currency)} in this group.`); return; }
      if(await askConfirm({ title: `Leave “${g.name}”?`, body: 'It disappears from your list. Everyone else keeps its history, with your name on the expenses you were part of. An invite link brings you back.', confirmLabel: 'Leave group' })){
        const { error } = await sb.rpc('leave_group', { gid: g.id });
        if(error){ oops(error, 'leave'); return; }
        state.activeGroupId = null;
        closeDialog(); navigate('#/overview'); await refresh();
        toast(`You left ${g.name}.`);
      }
    }
    else if(a==='archive-group' || a==='restore-group'){
      if(!g) return;
      const archiving = a === 'archive-group';
      if(archiving){
        const unsettled = Object.values(balances(g)).some(v => v !== 0);
        const ok = await askConfirm({
          title: `Archive “${g.name}”?`,
          body: (unsettled ? 'Some balances aren’t settled yet. They’ll stay as they are, and still count in your totals. ' : '')
            + 'It moves to Archived on Home and is frozen: nobody can add or change anything until someone restores it.',
          confirmLabel: 'Archive group', danger: false,
        });
        if(!ok) return;
      }
      const { error } = await sb.from('groups').update({ archived_at: archiving ? new Date().toISOString() : null }).eq('id', g.id);
      if(error){ oops(error, archiving ? 'archive' : 'restore'); return; }
      closeDialog(); await refresh();
      toast(archiving ? `Archived ${g.name}. It’s under Archived on Home.` : `Restored ${g.name}.`);
    }
    else if(a==='del-group'){
      if(!g || !canAdmin(g)) return;
      if(await askConfirm({ title: `Delete “${g.name}”?`, body: 'This deletes the group and all its expenses for everyone in it. The people in it stay saved.', confirmLabel: 'Delete group' })){
        /* Receipts go first: once the group is gone, nobody is a member who may delete them */
        await removeReceipts(await groupReceiptPaths(g.id));
        const { data: gone, error } = await sb.from('groups').delete().eq('id', g.id).select('id');
        if(error){ oops(error); return; }
        /* The security rules turn a non-admin's delete into "nothing deleted" rather than an error */
        if(!gone?.length){ fail('Only an admin can delete this group.'); return; }
        state.activeGroupId = null;
        closeDialog(); navigate('#/overview'); await refresh();
        toast(`Deleted ${g.name}.`);
      }
    }
  });
  document.addEventListener('change', ev => {
    if(ev.target.name === 'theme' && !ev.target.closest('dialog')) setTheme(ev.target.value);
  });
  document.addEventListener('input', ev => {
    if(ev.target.dataset.filter === 'activity') filterActivity(ev.target.value);
  });
  dlg.addEventListener('close', abortVoice);
  window.addEventListener('hashchange', () => {
    if(!session){ rememberPendingJoin(); return; }
    if(!myPersonId) return;
    closeDialog(); forgetTrigger();
    /* A short cross-fade between screens where the browser supports it; instant otherwise */
    const swap = () => { render(); window.scrollTo(0, 0); };
    if(document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(swap);
    else swap();
  });
  /* Other people edit shared groups too — pick up their changes when the app comes back into view */
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && myPersonId && !dlg.open && Date.now() - lastLoadedAt > 30000) refresh();
  });
}
