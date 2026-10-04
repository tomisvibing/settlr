-- "Simplify debts" as a per-group setting. On (the default) the group settles with the fewest payments,
-- which can route money through people who never owed each other. Off, each person pays back exactly
-- the people they owe, netted pair by pair.
alter table public.groups
  add column if not exists simplify_debts boolean not null default true;
