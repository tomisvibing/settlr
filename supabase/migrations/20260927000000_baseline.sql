-- settlr baseline schema.
--
-- A record of the live Supabase database as of 2026-09-27, taken before any
-- migrations were tracked. The live project already has all of this, so this
-- file must NOT be run against it; it is here so the schema is reviewable and
-- so a fresh project (or a local `supabase start`) can be built from scratch.
-- Every later change goes in a new, dated file in this folder.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A person who can appear in a ledger. Either a signed-in user's own contact
-- (user_id set) or a placeholder someone typed in, which the real person can
-- claim when they join a group.
create table public.people (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id),
  user_id    uuid references auth.users (id),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint uniq_self_person unique (owner_id, user_id)
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'GBP',
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (group_id, person_id)
);

-- Both expenses and in-group payments (type = 'payment'). amount_cents is in
-- the group's currency; split_input keeps what was typed (ticks, shares or
-- exact amounts) so the entry can be edited later.
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  type         text not null default 'expense',
  description  text not null,
  amount_cents integer not null,
  paid_by      uuid not null references public.people (id),
  split_mode   text not null default 'equal',
  expense_date date not null default current_date,
  created_at   timestamptz not null default now(),
  split_input  jsonb not null default '{}'::jsonb
);

-- Who owes what for each expense; always sums to the expense amount.
create table public.expense_splits (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  person_id    uuid not null references public.people (id),
  amount_cents integer not null
);

-- Settlements recorded outside any group.
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  from_person  uuid not null references public.people (id),
  to_person    uuid not null references public.people (id),
  amount_cents integer not null,
  currency     text not null default 'GBP',
  note         text,
  payment_date date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership helpers used by the row-level security policies
-- ---------------------------------------------------------------------------

create or replace function public.my_group_ids()
returns setof uuid
language sql
stable security definer
as $$
  select gm.group_id from group_members gm
  join people p on p.id = gm.person_id
  where p.user_id = auth.uid();
$$;

create or replace function public.is_member(gid uuid)
returns boolean
language sql
stable security definer
as $$
  select gid in (select my_group_ids());
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.people         enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.payments       enable row level security;

-- people: you manage the contacts you own, and can see anyone in your groups.
create policy "read own or shared people" on public.people for select
  using (owner_id = auth.uid()
         or exists (select 1 from group_members gm where gm.person_id = people.id and is_member(gm.group_id)));
create policy "add own people" on public.people for insert
  with check (owner_id = auth.uid());
create policy "update own people" on public.people for update
  using (owner_id = auth.uid());
create policy "delete own people" on public.people for delete
  using (owner_id = auth.uid());

-- groups: members can do anything to their groups.
create policy "member read groups" on public.groups for select
  using (is_member(id));
create policy "create groups" on public.groups for insert
  with check (auth.uid() = created_by);
create policy "member update groups" on public.groups for update
  using (is_member(id));
create policy "member delete groups" on public.groups for delete
  using (is_member(id));

-- group_members: the creator can seed a group before being a member of it.
create policy "read group members" on public.group_members for select
  using (is_member(group_id)
         or exists (select 1 from groups where groups.id = group_members.group_id and groups.created_by = auth.uid()));
create policy "add group members" on public.group_members for insert
  with check (is_member(group_id)
              or exists (select 1 from groups where groups.id = group_members.group_id and groups.created_by = auth.uid()));
create policy "remove group members" on public.group_members for delete
  using (is_member(group_id));

-- expenses: any member of the group.
create policy "member read expenses" on public.expenses for select
  using (is_member(group_id));
create policy "member write expenses" on public.expenses for insert
  with check (is_member(group_id));
create policy "member update expenses" on public.expenses for update
  using (is_member(group_id));
create policy "member delete expenses" on public.expenses for delete
  using (is_member(group_id));

-- expense_splits: follow the parent expense. No update policy: the app
-- replaces an expense's splits by deleting and re-inserting them.
create policy "member read splits" on public.expense_splits for select
  using (is_member((select expenses.group_id from expenses where expenses.id = expense_splits.expense_id)));
create policy "member write splits" on public.expense_splits for insert
  with check (is_member((select expenses.group_id from expenses where expenses.id = expense_splits.expense_id)));
create policy "member delete splits" on public.expense_splits for delete
  using (is_member((select expenses.group_id from expenses where expenses.id = expense_splits.expense_id)));

-- payments: visible to whoever owns either person in it.
create policy "read own payments" on public.payments for select
  using (exists (select 1 from people where people.id = payments.from_person and people.owner_id = auth.uid())
      or exists (select 1 from people where people.id = payments.to_person and people.owner_id = auth.uid()));
create policy "write own payments" on public.payments for insert
  with check (exists (select 1 from people where people.id = payments.from_person and people.owner_id = auth.uid())
           or exists (select 1 from people where people.id = payments.to_person and people.owner_id = auth.uid()));
create policy "own payments update" on public.payments for update
  using (exists (select 1 from people where people.id = payments.from_person and people.owner_id = auth.uid())
      or exists (select 1 from people where people.id = payments.to_person and people.owner_id = auth.uid()));
create policy "own payments delete" on public.payments for delete
  using (exists (select 1 from people where people.id = payments.from_person and people.owner_id = auth.uid())
      or exists (select 1 from people where people.id = payments.to_person and people.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs called by the app
-- ---------------------------------------------------------------------------

-- Creates a group and its members in one go. Needed because the creator isn't
-- a member yet when the rows are inserted, so plain inserts fail RLS.
create or replace function public.create_group(name text, currency text, member_person_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  pid uuid;
begin
  insert into groups (name, currency, created_by) values (name, currency, auth.uid()) returning id into gid;

  foreach pid in array member_person_ids loop
    insert into group_members (group_id, person_id) values (gid, pid) on conflict do nothing;
  end loop;

  return gid;
end;
$$;

-- Unclaimed placeholder people in the group behind an invite code, so someone
-- joining can say "that's me".
create or replace function public.preview_group_by_code(code text)
returns table (person_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from groups where invite_code = code;
  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  return query
    select p.id, p.name
    from people p
    join group_members gm on gm.person_id = p.id
    where gm.group_id = gid and p.user_id is null
    order by p.name;
end;
$$;

-- Join via invite code, either as yourself or by claiming a placeholder.
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
  on conflict do nothing;

  return gid;
end;
$$;

-- Permanently delete the signed-in user's account:
--   * Groups where nobody else has signed in are deleted with all their
--     expenses and splits.
--   * Groups shared with at least one other signed-in person are kept so
--     their balances stay correct. Ownership of the group, and of any
--     contacts it needs, passes to another signed-in member. The leaving
--     user's name stays on past expenses, but it's no longer linked to a
--     login (so it becomes a placeholder someone could claim again).
--   * Contacts and standalone settlements that nothing shared needs are deleted.
--   * Finally the auth user itself is deleted.
-- Everything runs in one transaction: if any step fails, nothing is deleted.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_people uuid[];
  group_ids uuid[];
  extra uuid[];
  gid uuid;
  heir uuid;
  col text;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- Every people row that is me: my own contact plus placeholders I claimed.
  select coalesce(array_agg(id), '{}') into my_people from people where user_id = uid;

  -- My name stays on shared history but is no longer tied to a login. Done
  -- first so moving these rows to a new owner can't clash with the
  -- (owner_id, user_id) uniqueness of a placeholder that owner made for me.
  update people set user_id = null where id = any(my_people);

  -- Groups to deal with: ones I'm a member of, plus any that point at my
  -- login directly (e.g. a created_by column), so an ON DELETE CASCADE from
  -- auth.users can't take a shared group down with me.
  select coalesce(array_agg(distinct group_id), '{}') into group_ids
    from group_members where person_id = any(my_people);
  for col in select a.attname from pg_constraint c
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
              where c.contype = 'f' and c.conrelid = 'public.groups'::regclass
                and c.confrelid = 'auth.users'::regclass
  loop
    execute format('select coalesce(array_agg(id), ''{}'') from public.groups where %I = $1', col)
      into extra using uid;
    group_ids := group_ids || extra;
  end loop;

  foreach gid in array coalesce((select array_agg(distinct x) from unnest(group_ids) x), '{}') loop
    -- Another signed-in member who can inherit the group.
    select p.user_id into heir
      from group_members gm join people p on p.id = gm.person_id
     where gm.group_id = gid and p.user_id is not null and p.user_id <> uid
     limit 1;

    if heir is null then
      delete from expense_splits where expense_id in (select id from expenses where group_id = gid);
      delete from expenses where group_id = gid;
      delete from group_members where group_id = gid;
      delete from groups where id = gid;
    else
      -- Contacts I own that this group's ledger depends on move to the heir.
      update people set owner_id = heir
       where owner_id = uid
         and (id in (select person_id from group_members where group_id = gid)
           or id in (select paid_by from expenses where group_id = gid)
           or id in (select s.person_id from expense_splits s join expenses e on e.id = s.expense_id where e.group_id = gid));
      -- Any column on groups / expenses that references my login moves to the heir too.
      for col in select a.attname from pg_constraint c
                   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
                  where c.contype = 'f' and c.conrelid = 'public.groups'::regclass
                    and c.confrelid = 'auth.users'::regclass
      loop
        execute format('update public.groups set %I = $1 where id = $2 and %I = $3', col, col) using heir, gid, uid;
      end loop;
      for col in select a.attname from pg_constraint c
                   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
                  where c.contype = 'f' and c.conrelid = 'public.expenses'::regclass
                    and c.confrelid = 'auth.users'::regclass
      loop
        execute format('update public.expenses set %I = $1 where group_id = $2 and %I = $3', col, col) using heir, gid, uid;
      end loop;
    end if;
  end loop;

  -- Contacts I own that another user's group still uses (without me in it)
  -- go to a signed-in member of that group.
  update people p set owner_id = h.user_id
    from (
      select distinct on (gm.person_id) gm.person_id, q.user_id
        from group_members gm
        join group_members gm2 on gm2.group_id = gm.group_id
        join people q on q.id = gm2.person_id
       where q.user_id is not null and q.user_id <> uid
       order by gm.person_id
    ) h
   where p.id = h.person_id and p.owner_id = uid;

  -- Standalone settlements involving contacts that are about to go, then
  -- anything else of mine that references my login directly.
  delete from payments
   where from_person in (select id from people where owner_id = uid)
      or to_person in (select id from people where owner_id = uid);
  for col in select a.attname from pg_constraint c
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
              where c.contype = 'f' and c.conrelid = 'public.payments'::regclass
                and c.confrelid = 'auth.users'::regclass
  loop
    execute format('delete from public.payments where %I = $1', col) using uid;
  end loop;

  delete from people where owner_id = uid;

  delete from auth.users where id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions (as on the live project)
-- ---------------------------------------------------------------------------

-- Only signed-in users read or write tables; RLS decides which rows.
revoke all on public.people, public.groups, public.group_members,
              public.expenses, public.expense_splits, public.payments
  from anon, authenticated, service_role;
grant references, trigger, truncate on public.people, public.groups, public.group_members,
              public.expenses, public.expense_splits, public.payments
  to anon, service_role;
grant select, insert, update, delete, references, trigger, truncate
  on public.people, public.groups, public.group_members,
     public.expenses, public.expense_splits, public.payments
  to authenticated;

-- my_group_ids, is_member, create_group, preview_group_by_code and
-- join_group_by_code keep Postgres's default EXECUTE for everyone.
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
grant execute on function public.preview_group_by_code(text) to authenticated;
grant execute on function public.join_group_by_code(text, uuid) to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
