-- Live updates, group admins, and leaving a group.
--
-- 1. Live updates: the app's tables join the supabase_realtime publication,
--    so the app hears about changes as they happen. Realtime checks each
--    change against the same row-level security as a normal read, so people
--    only hear about groups they're in. (Deletes carry only the row's id.)
--
-- 2. Admins: group_members gets a role. Whoever creates a group is its admin
--    and admins can make other members admins. Only admins can delete the
--    group or remove someone who has an account. A group left with no admin
--    who has an account (e.g. after an account deletion) is run by all its
--    members, so it can never get stuck.
--
-- 3. Leaving: a member who has settled up can leave. Their membership row
--    stays, marked left_at, so their name still shows on the group's history
--    for everyone else, but they lose access to the group. The last admin
--    leaving hands the role on. An invite link brings them back.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.group_members
  add column if not exists role text not null default 'member',
  add column if not exists left_at timestamptz;

alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check check (role in ('admin', 'member'));

-- Existing groups: the creator is the admin; groups whose creator isn't a
-- member get every member with an account as admin.
update public.group_members gm set role = 'admin'
  from public.groups g, public.people p
 where g.id = gm.group_id and p.id = gm.person_id and p.user_id = g.created_by;

update public.group_members gm set role = 'admin'
  from public.people p
 where p.id = gm.person_id and p.user_id is not null
   and not exists (select 1 from public.group_members a where a.group_id = gm.group_id and a.role = 'admin');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Groups I'm in: leaving takes a group out of this list, and every security
-- rule is built on it, so leaving removes access everywhere at once.
create or replace function private.my_group_ids()
returns setof uuid
language sql
stable security definer
set search_path = ''
as $$
  select gm.group_id from public.group_members gm
  join public.people p on p.id = gm.person_id
  where p.user_id = auth.uid() and gm.left_at is null;
$$;

-- An admin of the group, or any member of a group that has no admin with an
-- account left.
create or replace function private.is_group_admin(gid uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select private.is_member(gid) and (
    exists (select 1 from public.group_members gm join public.people p on p.id = gm.person_id
             where gm.group_id = gid and gm.left_at is null and gm.role = 'admin' and p.user_id = auth.uid())
    or not exists (select 1 from public.group_members gm join public.people p on p.id = gm.person_id
                    where gm.group_id = gid and gm.left_at is null and gm.role = 'admin' and p.user_id is not null)
  );
$$;

revoke all on function private.is_group_admin(uuid) from public, anon;
grant execute on function private.is_group_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

drop policy if exists "member delete groups" on public.groups;
create policy "admin delete groups" on public.groups for delete
  using (private.is_group_admin(id));

-- Creating a group goes through create_group, so the "or I created it" escape
-- hatch on these two isn't needed any more (and would let a creator who left
-- keep reading the member list).
drop policy if exists "read group members" on public.group_members;
create policy "read group members" on public.group_members for select
  using (private.is_member(group_id));

drop policy if exists "add group members" on public.group_members;
create policy "add group members" on public.group_members for insert
  with check (private.is_member(group_id) and private.can_see_person(person_id) and role = 'member' and left_at is null);

-- Anyone can take a name without an account off the group (the app only
-- offers it when they're in no expenses); removing someone with an account
-- is for admins.
drop policy if exists "remove group members" on public.group_members;
create policy "remove group members" on public.group_members for delete
  using (private.is_member(group_id)
         and (private.is_group_admin(group_id)
              or not exists (select 1 from public.people p where p.id = person_id and p.user_id is not null)));

-- ---------------------------------------------------------------------------
-- Functions the app calls
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
    insert into group_members (group_id, person_id, role)
    values (gid, pid, case when exists (select 1 from people where id = pid and user_id = uid) then 'admin' else 'member' end)
    on conflict do nothing;
  end loop;

  return gid;
end;
$$;

-- Same as before, except that joining a group you left brings you back.
create or replace function public.join_group_by_code(code text, claim_person_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  my_person_id uuid;
begin
  select id into gid from groups where invite_code = code;
  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  if claim_person_id is not null then
    update people
    set user_id = auth.uid(), owner_id = auth.uid()
    where id = claim_person_id
      and user_id is null
      and exists (select 1 from group_members where group_id = gid and person_id = claim_person_id);
    if not found then
      raise exception 'That person cannot be claimed';
    end if;
    return gid;
  end if;

  select id into my_person_id from people where owner_id = auth.uid() and user_id = auth.uid() limit 1;
  if my_person_id is null then
    insert into people (owner_id, user_id, name)
    values (auth.uid(), auth.uid(), coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = auth.uid()), 'Me'))
    returning id into my_person_id;
  end if;

  insert into group_members (group_id, person_id) values (gid, my_person_id)
  on conflict (group_id, person_id) do update set left_at = null;

  return gid;
end;
$$;

-- Leave a group. Refused while you owe or are owed anything in it, or when
-- nobody else with an account would be left to run it.
create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine uuid[];
  bal bigint;
  heir uuid;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(array_agg(gm.person_id), '{}') into mine
    from group_members gm join people p on p.id = gm.person_id
   where gm.group_id = gid and gm.left_at is null and p.user_id = uid;
  if cardinality(mine) = 0 then
    raise exception 'You''re not in this group';
  end if;

  select coalesce((select sum(amount_cents) from expenses where group_id = gid and paid_by = any(mine)), 0)
       - coalesce((select sum(s.amount_cents) from expense_splits s join expenses e on e.id = s.expense_id
                    where e.group_id = gid and s.person_id = any(mine)), 0)
    into bal;
  if bal <> 0 then
    raise exception 'Settle up before leaving: your balance in this group isn''t zero';
  end if;

  if not exists (select 1 from group_members gm join people p on p.id = gm.person_id
                  where gm.group_id = gid and gm.left_at is null and p.user_id is not null and p.user_id <> uid) then
    raise exception 'You''re the only one here with an account. Delete the group instead';
  end if;

  -- The last admin hands the role to someone else with an account.
  if exists (select 1 from group_members where group_id = gid and person_id = any(mine) and role = 'admin')
     and not exists (select 1 from group_members gm join people p on p.id = gm.person_id
                      where gm.group_id = gid and gm.left_at is null and gm.role = 'admin'
                        and p.user_id is not null and p.user_id <> uid) then
    select gm.person_id into heir
      from group_members gm join people p on p.id = gm.person_id
     where gm.group_id = gid and gm.left_at is null and p.user_id is not null and p.user_id <> uid
     order by p.name
     limit 1;
    update group_members set role = 'admin' where group_id = gid and person_id = heir;
  end if;

  update group_members set left_at = now(), role = 'member'
   where group_id = gid and person_id = any(mine);
end;
$$;

-- Make a member an admin, or stop them being one. Admins only; a group always
-- keeps at least one admin with an account.
create or replace function public.set_group_admin(gid uuid, pid uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_group_admin(gid) then
    raise exception 'Only an admin can change who runs this group';
  end if;
  if not exists (select 1 from group_members gm join people p on p.id = gm.person_id
                  where gm.group_id = gid and gm.person_id = pid and gm.left_at is null and p.user_id is not null) then
    raise exception 'Only people with an account can be admins';
  end if;
  if not make_admin and not exists (
       select 1 from group_members gm join people p on p.id = gm.person_id
        where gm.group_id = gid and gm.left_at is null and gm.role = 'admin'
          and p.user_id is not null and gm.person_id <> pid) then
    raise exception 'A group needs at least one admin';
  end if;
  update group_members set role = case when make_admin then 'admin' else 'member' end
   where group_id = gid and person_id = pid;
end;
$$;

revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.set_group_admin(uuid, uuid, boolean) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.set_group_admin(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['groups', 'group_members', 'people', 'expenses', 'expense_splits', 'payments'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
