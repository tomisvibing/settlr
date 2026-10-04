/* The labels an expense can carry (tested in test/insights.test.js). The database accepts exactly these keys. */
export const CATEGORIES = [
  ['food', 'Eating out'], ['groceries', 'Groceries'], ['transport', 'Transport'], ['stay', 'Stay'],
  ['fun', 'Fun'], ['bills', 'Bills'], ['shopping', 'Shopping'], ['other', 'Other'],
];
export const categoryLabel = key => CATEGORIES.find(([k]) => k === key)?.[1] || 'Uncategorised';
