-- "Decide later": an expense typed before it has a group is kept as a private
-- draft ("To sort" on the overview) until its owner picks a group, when the
-- app turns it into a real expense and deletes the draft. Drafts belong to one
-- login and are visible to nobody else; they never touch balances.

create table if not exists public.expense_drafts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid(),
  description  text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency     text not null default 'GBP',
  created_at   timestamptz not null default now()
);
create index if not exists expense_drafts_owner_idx on public.expense_drafts (owner_id);

alter table public.expense_drafts enable row level security;
revoke all on public.expense_drafts from anon;
grant select, insert, update, delete on public.expense_drafts to authenticated;

drop policy if exists "owner reads drafts" on public.expense_drafts;
create policy "owner reads drafts" on public.expense_drafts for select
  using (owner_id = (select auth.uid()));
drop policy if exists "owner adds drafts" on public.expense_drafts;
create policy "owner adds drafts" on public.expense_drafts for insert
  with check (owner_id = (select auth.uid()));
drop policy if exists "owner updates drafts" on public.expense_drafts;
create policy "owner updates drafts" on public.expense_drafts for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "owner deletes drafts" on public.expense_drafts;
create policy "owner deletes drafts" on public.expense_drafts for delete
  using (owner_id = (select auth.uid()));
