-- Expense categories, for the insights on each group's page. Optional: older entries and anything
-- added without picking one stay null and show as "Uncategorised". The keys match
-- src/lib/categories.js.
--
-- Not added to the history summary (private.entry_summary), so changing only a category isn't
-- logged as an edit. Not added to recurring_expenses either: entries a schedule adds are
-- uncategorised, and you can set one on the entry afterwards.

alter table public.expenses
  add column if not exists category text
  check (category is null or category in ('food', 'groceries', 'transport', 'stay', 'fun', 'bills', 'shopping', 'other'));
