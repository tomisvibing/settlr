/* App state, populated from Supabase by loadAllData (data.js).
   Exported bindings are live: other modules always read the current value,
   but only this module can reassign them, via the setters. */
const emptyState = () => ({ people: [], groups: [], payments: [], payHandles: {}, drafts: [], myIds: new Set(), activeGroupId: null });

export let state = emptyState();
export let session = null;
export let myPersonId = null;

export const resetState = () => { state = emptyState(); };
export const setSession = s => { session = s; };
export const setMyPersonId = id => { myPersonId = id; };

export const PENDING_JOIN_KEY = 'settlr:pendingJoin';

/* A payment just recorded from a group's "Mark paid": the group page stamps it once, then forgets it */
let justPaid = null;
export const setJustPaid = p => { justPaid = p; };
export const takeJustPaid = gid => { const p = justPaid?.gid === gid ? justPaid : null; justPaid = null; return p; };
