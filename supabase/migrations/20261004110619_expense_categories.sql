-- Expense categories: an optional label on each expense (food, transport…), used for spending insights.
-- Null means uncategorised, which is every existing expense and anything a schedule adds.
alter table public.expenses
  add column if not exists category text;

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category is null or category in ('food','groceries','transport','stay','fun','bills','shopping','other')
);
