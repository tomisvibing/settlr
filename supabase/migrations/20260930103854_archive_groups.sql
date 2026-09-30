-- Archiving a group: frozen, but kept.
--
-- Any member can archive a group (set archived_at) or restore it (clear it),
-- through the existing "member update groups" rule. While a group is
-- archived its entries are read-only for everyone: no new expenses or
-- payments, no edits, no deletes, and no new receipts. Everything stays
-- readable, and balances still count. Deleting a group is still for admins.

alter table public.groups add column if not exists archived_at timestamptz;

-- Whether a group takes changes: it exists and isn't archived.
create or replace function private.group_open(gid uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.groups where id = gid and archived_at is null);
$$;

revoke all on function private.group_open(uuid) from public, anon;
grant execute on function private.group_open(uuid) to authenticated;

drop policy if exists "member write expenses" on public.expenses;
create policy "member write expenses" on public.expenses for insert
  with check (private.is_member(group_id) and private.group_open(group_id));

drop policy if exists "member update expenses" on public.expenses;
create policy "member update expenses" on public.expenses for update
  using (private.is_member(group_id) and private.group_open(group_id))
  with check (private.is_member(group_id) and private.group_open(group_id));

drop policy if exists "member delete expenses" on public.expenses;
create policy "member delete expenses" on public.expenses for delete
  using (private.is_member(group_id) and private.group_open(group_id));

drop policy if exists "member write splits" on public.expense_splits;
create policy "member write splits" on public.expense_splits for insert
  with check (private.is_member((select e.group_id from public.expenses e where e.id = expense_splits.expense_id))
              and private.group_open((select e.group_id from public.expenses e where e.id = expense_splits.expense_id)));

drop policy if exists "member delete splits" on public.expense_splits;
create policy "member delete splits" on public.expense_splits for delete
  using (private.is_member((select e.group_id from public.expenses e where e.id = expense_splits.expense_id))
         and private.group_open((select e.group_id from public.expenses e where e.id = expense_splits.expense_id)));

drop policy if exists "members add receipts" on storage.objects;
create policy "members add receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member(private.receipt_group_id(name))
              and private.group_open(private.receipt_group_id(name)));
