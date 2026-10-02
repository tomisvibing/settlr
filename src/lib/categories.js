/* What an expense was for. The keys are also the database's check list (supabase/migrations/20261002100000_expense_categories.sql) */
export const CATEGORIES = [
  { key: 'food', label: 'Food & drink' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'transport', label: 'Transport' },
  { key: 'stay', label: 'Stay' },
  { key: 'fun', label: 'Fun' },
  { key: 'bills', label: 'Bills' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'other', label: 'Other' },
];
export const categoryLabel = key => CATEGORIES.find(c => c.key === key)?.label || 'Uncategorised';
export const isCategory = key => CATEGORIES.some(c => c.key === key);
