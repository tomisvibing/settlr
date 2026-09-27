-- Fixes what Supabase's security and performance advisors flag on the baseline.
--
-- 1. The membership helpers move to a `private` schema, which the REST API
--    doesn't expose, and pin their search_path. RLS policies refer to
--    functions by OID, so existing policies keep working through the move.
-- 2. The RPCs can only be called by signed-in users (they were executable by
--    anyone, including signed-out visitors).
-- 3. create_group and the "add group members" policy only accept people the
--    caller can already see (private.can_see_person), instead of any person ID.
-- 4. Indexes for every unindexed foreign key.
-- 5. Policies call auth.uid() once per query, via (select auth.uid()),
--    instead of once per row.

-- ---------------------------------------------------------------------------
-- 1. Membership helpers
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
-- Policies run these as the signed-in user, so that role needs access.
grant usage on schema private to authenticated;

alter function public.my_group_ids() set schema private;
alter function public.is_member(uuid) set schema private;

create or replace function private.my_group_ids()
returns setof uuid
language sql
stable security definer
set search_path = ''
as $$
  select gm.group_id from public.group_members gm
  join public.people p on p.id = gm.person_id
  where p.user_id = auth.uid();
$$;

create or replace function private.is_member(gid uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select gid in (select private.my_group_ids());
$$;

-- Whether the caller can see a person: their own contact, themselves, or
-- someone in a group they belong to. Security definer so the "add group
-- members" policy can ask without re-entering group_members' own RLS, which
-- Postgres rejects as infinite recursion.
create or replace function private.can_see_person(pid uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p
     where p.id = pid
       and (p.owner_id = auth.uid()
            or p.user_id = auth.uid()
            or exists (select 1 from public.group_members gm
                        where gm.person_id = p.id
                          and gm.group_id in (select private.my_group_ids())))
  );
$$;

revoke all on function private.my_group_ids() from public, anon;
revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.can_see_person(uuid) from public, anon;
grant execute on function private.my_group_ids() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.can_see_person(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2 & 3. RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_group(name text, currency text, member_person_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  pid uuid;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from unnest(member_person_ids) as m(id) where not private.can_see_person(m.id)) then
    raise exception 'You can only add people you know';
  end if;

  insert into groups (name, currency, created_by) values (name, currency, uid) returning id into gid;

  foreach pid in array member_person_ids loop
    insert into group_members (group_id, person_id) values (gid, pid) on conflict do nothing;
  end loop;

  return gid;
end;
$$;

revoke execute on function public.create_group(text, text, uuid[]) from public, anon;
revoke execute on function public.preview_group_by_code(text) from public, anon;
revoke execute on function public.join_group_by_code(text, uuid) from public, anon;
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
grant execute on function public.preview_group_by_code(text) to authenticated;
grant execute on function public.join_group_by_code(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 & 5. Policies
-- ---------------------------------------------------------------------------

drop policy "read own or shared people" on public.people;
create policy "read own or shared people" on public.people for select
  using (owner_id = (select auth.uid())
         or exists (select 1 from public.group_members gm
                     where gm.person_id = people.id and private.is_member(gm.group_id)));

drop policy "add own people" on public.people;
create policy "add own people" on public.people for insert
  with check (owner_id = (select auth.uid()));

drop policy "update own people" on public.people;
create policy "update own people" on public.people for update
  using (owner_id = (select auth.uid()));

drop policy "delete own people" on public.people;
create policy "delete own people" on public.people for delete
  using (owner_id = (select auth.uid()));

drop policy "create groups" on public.groups;
create policy "create groups" on public.groups for insert
  with check (created_by = (select auth.uid()));

drop policy "read group members" on public.group_members;
create policy "read group members" on public.group_members for select
  using (private.is_member(group_id)
         or exists (select 1 from public.groups
                     where groups.id = group_members.group_id and groups.created_by = (select auth.uid())));

drop policy "add group members" on public.group_members;
create policy "add group members" on public.group_members for insert
  with check ((private.is_member(group_id)
               or exists (select 1 from public.groups
                           where groups.id = group_members.group_id and groups.created_by = (select auth.uid())))
              and private.can_see_person(person_id));

drop policy "read own payments" on public.payments;
create policy "read own payments" on public.payments for select
  using (exists (select 1 from public.people where people.id = payments.from_person and people.owner_id = (select auth.uid()))
      or exists (select 1 from public.people where people.id = payments.to_person and people.owner_id = (select auth.uid())));

drop policy "write own payments" on public.payments;
create policy "write own payments" on public.payments for insert
  with check (exists (select 1 from public.people where people.id = payments.from_person and people.owner_id = (select auth.uid()))
           or exists (select 1 from public.people where people.id = payments.to_person and people.owner_id = (select auth.uid())));

drop policy "own payments update" on public.payments;
create policy "own payments update" on public.payments for update
  using (exists (select 1 from public.people where people.id = payments.from_person and people.owner_id = (select auth.uid()))
      or exists (select 1 from public.people where people.id = payments.to_person and people.owner_id = (select auth.uid())));

drop policy "own payments delete" on public.payments;
create policy "own payments delete" on public.payments for delete
  using (exists (select 1 from public.people where people.id = payments.from_person and people.owner_id = (select auth.uid()))
      or exists (select 1 from public.people where people.id = payments.to_person and people.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 4. Foreign-key indexes
-- ---------------------------------------------------------------------------

create index if not exists expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index if not exists expense_splits_person_id_idx  on public.expense_splits (person_id);
create index if not exists expenses_group_id_idx         on public.expenses (group_id);
create index if not exists expenses_paid_by_idx          on public.expenses (paid_by);
create index if not exists group_members_person_id_idx   on public.group_members (person_id);
create index if not exists groups_created_by_idx         on public.groups (created_by);
create index if not exists payments_from_person_idx      on public.payments (from_person);
create index if not exists payments_to_person_idx        on public.payments (to_person);
create index if not exists people_user_id_idx            on public.people (user_id);
