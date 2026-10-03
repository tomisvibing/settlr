/* What the new-expense button says (tested in test/compose.test.js). It names what pressing it will
   do: go on to the next missing part, hand over to the full sheet, save for later, or add the
   expense, so "Add" never reads like "next" when it isn't */
export const PART_LABEL = { group: 'pick a group', amount: 'amount', what: 'what for', who: 'who it’s for' };

/* The first part still needed, in the order the sentence is filled in, or null when it's complete */
export function missingPart({ hasGroup, later, pence, what, whoCount }){
  if(!hasGroup && !later) return 'group';
  if(!(pence > 0)) return 'amount';
  if(!what.trim()) return 'what';
  if(hasGroup && !whoCount) return 'who';
  return null;
}

export function goLabel({ missing, mode, hasGroup, amountText, groupName }){
  if(missing === 'group') return `Next: ${PART_LABEL.group}`;
  if(hasGroup && mode !== 'equal') return 'Set the amounts';
  if(missing) return `Next: ${PART_LABEL[missing]}`;
  return hasGroup ? `Add ${amountText} to ${groupName}` : 'Save for later';
}
