/* What the new-expense button says (tested in test/compose.test.js). It names what pressing it will
   do: move on to the next part that's still missing, hand over to the full sheet, save for later, or
   add the expense. It never points at the part you're already on, and it reads as an inactive "Add"
   when that's the only thing left to fill in */
export const PART_LABEL = { group: 'pick a group', amount: 'amount', what: 'what for', who: 'who it’s for' };
const ORDER = ['group', 'amount', 'what', 'who'];

/* Every part still needed, in the order the sentence is filled in */
export function missingParts({ hasGroup, later, pence, what, whoCount }){
  const m = [];
  if(!hasGroup && !later) m.push('group');
  if(!(pence > 0)) m.push('amount');
  if(!what.trim()) m.push('what');
  if(hasGroup && !whoCount) m.push('who');
  return m;
}

/* The next missing part after the one that's open (wrapping round), or null when the open part is the
   only one left */
export function nextTarget(missing, open){
  const others = missing.filter(p => p !== open);
  if(!others.length) return null;
  return others.find(p => ORDER.indexOf(p) > ORDER.indexOf(open)) || others[0];
}

export function goLabel({ missing, open, mode, hasGroup, amountText, groupName }){
  if(hasGroup && mode !== 'equal') return 'Set the amounts';
  const next = nextTarget(missing, open);
  if(next) return `Next: ${PART_LABEL[next]}`;
  if(!hasGroup) return 'Save for later';
  return missing.length ? `Add to ${groupName}` : `Add ${amountText} to ${groupName}`;
}

/* Pressing it won't do anything yet: only the part you're on is still empty */
export const isIdle = ({ missing, open, mode, hasGroup }) => !(hasGroup && mode !== 'equal') && missing.length > 0 && nextTarget(missing, open) === null;
