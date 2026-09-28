/* Page-wide event delegation: every button carries a data-action */
import { sb } from './supabase.js';
import { state, session, myPersonId } from './store.js';
import { setTheme } from './theme.js';
import { toast } from './ui.js';
import { group, personLocked } from './selectors.js';
import { refresh, lastLoadedAt } from './data.js';
import { render, navigate } from './router.js';
import { rememberPendingJoin } from './auth.js';
import { shareInvite, exportGroupCsv, exportAll } from './share.js';
import { filterActivity } from './views/group.js';
import { dlg, closeDialog, fail, describeError } from './dialogs/dialog.js';
import { openExpense, openAddExpense } from './dialogs/expense.js';
import { openVoiceExpense, abortVoice } from './dialogs/voice.js';
import { openPayment } from './dialogs/payment.js';
import { openSettlement } from './dialogs/settlement.js';
import { openPerson } from './dialogs/person.js';
import { openGroup, addPendingMember } from './dialogs/group.js';
import { openJoinGroup } from './dialogs/join.js';
import { openProfile, openDeleteAccount, signOut } from './dialogs/account.js';
import { askConfirm } from './dialogs/confirm.js';
import { removeReceipts, groupReceiptPaths } from './receipts.js';

/* A failed delete shows in the sheet it came from, or as a toast when it came from a swiped row */
const oops = err => { if(dlg.open) fail(describeError(err)); else toast(describeError(err)); };

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
    else if(a==='pick-group'){ state.activeGroupId = b.dataset.id; openExpense(); }
    else if(a==='voice-expense') openVoiceExpense();
    else if(a==='edit-expense') openExpense(b.dataset.id);
    else if(a==='add-payment') openPayment();
    else if(a==='edit-payment') openPayment({id:b.dataset.id});
    else if(a==='settle') openPayment({from:b.dataset.from, to:b.dataset.to, amount:+b.dataset.amount});
    else if(a==='add-person') openPerson();
    else if(a==='edit-person') openPerson(b.dataset.id);
    else if(a==='del-person'){
      if(!personLocked(b.dataset.id) && await askConfirm({ title: 'Delete this person?', body: 'They’re not in any group or settlement, so nothing else changes.' })){
        const { error } = await sb.from('people').delete().eq('id', b.dataset.id);
        if(error){ fail(describeError(error)); return; }
        closeDialog(); await refresh();
      }
    }
    else if(a==='add-settlement') openSettlement();
    else if(a==='edit-settlement') openSettlement({id:b.dataset.id});
    else if(a==='del-settlement'){
      if(await askConfirm({ title: 'Delete this settlement?' })){
        const { error } = await sb.from('payments').delete().eq('id', b.dataset.id);
        if(error){ oops(error); return; }
        closeDialog(); await refresh();
      }
    }
    else if(a==='close') closeDialog();
    else if(a==='add-member') await addPendingMember();
    else if(a==='invite'){ if(g) await shareInvite(g); }
    else if(a==='export-group'){ if(g) exportGroupCsv(g); }
    else if(a==='export-all') exportAll();
    else if(a==='edit-profile') openProfile();
    else if(a==='delete-account') openDeleteAccount();
    else if(a==='sign-out') await signOut();
    else if(a==='retry') location.reload();
    else if(a==='del-entry'){
      if(await askConfirm({ title: 'Delete this entry?', body: 'Everyone’s balances in the group update straight away.' })){
        const receipt = g?.expenses.find(e => e.id === b.dataset.id)?.receipt;
        const { error } = await sb.from('expenses').delete().eq('id', b.dataset.id);
        if(error){ oops(error); return; }
        if(receipt) removeReceipts([receipt]);
        closeDialog(); await refresh();
      }
    }
    else if(a==='del-group'){
      if(await askConfirm({ title: `Delete “${g.name}”?`, body: 'This deletes the group and all its expenses for everyone in it. The people in it stay saved.', confirmLabel: 'Delete group' })){
        /* Receipts go first: once the group is gone, nobody is a member who may delete them */
        if(g.expenses.some(e => e.receipt)) await removeReceipts(await groupReceiptPaths(g.id));
        const { error } = await sb.from('groups').delete().eq('id', g.id);
        if(error){ fail(describeError(error)); return; }
        state.activeGroupId = null;
        closeDialog(); navigate('#/'); await refresh();
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
    closeDialog();
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
