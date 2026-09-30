-- Multiple currencies in a group, change history with undo, and comments.
--
-- 1. Currencies: an expense (or payment) can be entered in any currency. The
--    app converts it into the group's currency when it's saved, at a rate it
--    fetches or the person types, and keeps both: amount_cents stays in the
--    group's currency (so balances and settling up are unchanged) and
--    orig_currency / orig_amount_cents / fx_rate record what was spent.
--    A group's currency can't change once it has entries, because that would
--    silently relabel every amount.
--
-- 2. History: activity_log records who added, edited or deleted what, and
--    group changes (renamed, archived, restored, people joining or leaving).
--    Triggers write it, so nothing the app does can skip it, and members can
--    only read it. A deleted entry's log row keeps a full copy (with its
--    splits and comments), and restore_deleted_expense puts it back.
--
-- 3. Comments: expense_comments, readable by the group, written by members
--    while the group isn't archived, deletable by their author.

-- ---------------------------------------------------------------------------
-- 1. Currencies
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column if not exists orig_currency text,
  add column if not exists orig_amount_cents bigint,
  add column if not exists fx_rate numeric;

alter table public.expenses drop constraint if exists expenses_orig_currency_check;
alter table public.expenses add constraint expenses_orig_currency_check check (
  (orig_currency is null and orig_amount_cents is null and fx_rate is null)
  or (orig_currency is not null and orig_amount_cents is not null and fx_rate > 0)
);

create or replace function private.lock_group_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency
     and exists (select 1 from public.expenses where group_id = old.id) then
    raise exception 'This group already has expenses, so its currency can''t change';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_group_currency on public.groups;
create trigger lock_group_currency before update of currency on public.groups
  for each row execute function private.lock_group_currency();

-- ---------------------------------------------------------------------------
-- 3. Comments (before history, whose delete snapshot includes them)
-- ---------------------------------------------------------------------------

create table if not exists public.expense_comments (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  group_id      uuid not null references public.groups (id) on delete cascade,
  author_user   uuid,
  author_person uuid references public.people (id) on delete set null,
  body          text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index if not exists expense_comments_expense_id_idx on public.expense_comments (expense_id);
create index if not exists expense_comments_group_id_idx on public.expense_comments (group_id);
create index if not exists expense_comments_author_person_idx on public.expense_comments (author_person);

-- The group comes from the expense and the author from the signed-in user,
-- so neither can be forged. (A restore brings back the original author.)
create or replace function private.fill_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.group_id := (select e.group_id from public.expenses e where e.id = new.expense_id);
  new.author_user := coalesce(new.author_user, auth.uid());
  new.author_person := coalesce(new.author_person,
    (select gm.person_id from public.group_members gm join public.people p on p.id = gm.person_id
      where gm.group_id = new.group_id and p.user_id = new.author_user limit 1));
  return new;
end;
$$;

drop trigger if exists fill_comment on public.expense_comments;
create trigger fill_comment before insert on public.expense_comments
  for each row execute function private.fill_comment();

alter table public.expense_comments enable row level security;
revoke all on public.expense_comments from anon;
grant select, insert, delete on public.expense_comments to authenticated;

drop policy if exists "members read comments" on public.expense_comments;
create policy "members read comments" on public.expense_comments for select
  using (private.is_member(group_id));
drop policy if exists "members add comments" on public.expense_comments;
create policy "members add comments" on public.expense_comments for insert
  with check (private.is_member(group_id) and private.group_open(group_id) and author_user = (select auth.uid()));
drop policy if exists "authors delete comments" on public.expense_comments;
create policy "authors delete comments" on public.expense_comments for delete
  using (author_user = (select auth.uid()) and private.group_open(group_id));

-- ---------------------------------------------------------------------------
-- 2. History
-- ---------------------------------------------------------------------------

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  actor_user  uuid,
  actor_name  text,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_log_group_idx on public.activity_log (group_id, created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log (entity_id);

alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon;
grant select on public.activity_log to authenticated;
drop policy if exists "members read history" on public.activity_log;
create policy "members read history" on public.activity_log for select
  using (private.is_member(group_id));

-- Write one history row, naming whoever is signed in as they appear in the group.
create or replace function private.log_activity(gid uuid, act text, ent text, eid uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The group is on its way out (deleted, cascading): nothing to record
  if not exists (select 1 from public.groups where id = gid) then return; end if;
  insert into public.activity_log (group_id, actor_user, actor_name, action, entity, entity_id, data)
  values (gid, auth.uid(),
    coalesce((select p.name from public.group_members gm join public.people p on p.id = gm.person_id
               where gm.group_id = gid and p.user_id = auth.uid() limit 1),
             (select p.name from public.people p where p.user_id = auth.uid() limit 1)),
    act, ent, eid, coalesce(payload, '{}'::jsonb));
end;
$$;

-- The parts of an entry worth showing in its history
create or replace function private.entry_summary(e public.expenses)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('description', e.description, 'amount_cents', e.amount_cents,
    'paid_by', e.paid_by, 'expense_date', e.expense_date, 'split_mode', e.split_mode,
    'split_input', e.split_input, 'orig_currency', e.orig_currency, 'orig_amount_cents', e.orig_amount_cents);
$$;

create or replace function private.log_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ent text;
begin
  -- restore_deleted_expense writes its own "restored" row
  if current_setting('settlr.restoring', true) = 'on' then return coalesce(new, old); end if;
  ent := case when coalesce(new.type, old.type) = 'payment' then 'payment' else 'expense' end;
  if tg_op = 'INSERT' then
    perform private.log_activity(new.group_id, 'added', ent, new.id, jsonb_build_object('after', private.entry_summary(new)));
  elsif tg_op = 'UPDATE' then
    if private.entry_summary(new) is distinct from private.entry_summary(old) then
      perform private.log_activity(new.group_id, 'edited', ent, new.id,
        jsonb_build_object('before', private.entry_summary(old), 'after', private.entry_summary(new)));
    end if;
  else
    -- A full copy, so the entry can be restored exactly
    perform private.log_activity(old.group_id, 'deleted', ent, old.id, jsonb_build_object(
      'before', private.entry_summary(old),
      'snapshot', jsonb_build_object(
        'expense', to_jsonb(old),
        'splits', coalesce((select jsonb_agg(to_jsonb(s)) from public.expense_splits s where s.expense_id = old.id), '[]'::jsonb),
        'comments', coalesce((select jsonb_agg(to_jsonb(c)) from public.expense_comments c where c.expense_id = old.id), '[]'::jsonb))));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_expense_write on public.expenses;
create trigger log_expense_write after insert or update on public.expenses
  for each row execute function private.log_expense();
-- Before, so the splits and comments are still there to copy
drop trigger if exists log_expense_delete on public.expenses;
create trigger log_expense_delete before delete on public.expenses
  for each row execute function private.log_expense();

create or replace function private.log_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.id, 'created', 'group', new.id, jsonb_build_object('name', new.name));
    return new;
  end if;
  if new.name is distinct from old.name then
    perform private.log_activity(new.id, 'renamed', 'group', new.id, jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  if old.archived_at is null and new.archived_at is not null then
    perform private.log_activity(new.id, 'archived', 'group', new.id, '{}'::jsonb);
  elsif old.archived_at is not null and new.archived_at is null then
    perform private.log_activity(new.id, 'restored', 'group', new.id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists log_group on public.groups;
create trigger log_group after insert or update on public.groups
  for each row execute function private.log_group();

create or replace function private.log_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid := coalesce(new.group_id, old.group_id);
  pname text := (select name from public.people where id = coalesce(new.person_id, old.person_id));
begin
  -- The people a group starts with are part of "created", not separate joins
  if tg_op = 'INSERT' and exists (select 1 from public.groups where id = gid and created_at = now()) then return new; end if;
  if tg_op = 'INSERT' then
    perform private.log_activity(gid, 'joined', 'member', new.person_id, jsonb_build_object('name', pname));
  elsif tg_op = 'UPDATE' then
    if old.left_at is null and new.left_at is not null then
      perform private.log_activity(gid, 'left', 'member', new.person_id, jsonb_build_object('name', pname));
    elsif old.left_at is not null and new.left_at is null then
      perform private.log_activity(gid, 'rejoined', 'member', new.person_id, jsonb_build_object('name', pname));
    elsif old.role is distinct from new.role then
      perform private.log_activity(gid, case when new.role = 'admin' then 'made_admin' else 'unmade_admin' end, 'member', new.person_id, jsonb_build_object('name', pname));
    end if;
  else
    perform private.log_activity(gid, 'removed', 'member', old.person_id, jsonb_build_object('name', pname));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_member on public.group_members;
create trigger log_member after insert or update or delete on public.group_members
  for each row execute function private.log_member();

-- Put a deleted entry back exactly as it was, from its history snapshot.
create or replace function public.restore_deleted_expense(eid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snap jsonb;
  gid uuid;
begin
  select l.data->'snapshot', l.group_id into snap, gid
    from public.activity_log l
   where l.entity_id = eid and l.action = 'deleted' and l.data ? 'snapshot'
   order by l.created_at desc limit 1;
  if snap is null or not private.is_member(gid) then
    raise exception 'That entry can''t be restored';
  end if;
  if not private.group_open(gid) then
    raise exception 'This group is archived. Restore the group first';
  end if;
  if exists (select 1 from public.expenses where id = eid) then
    return eid;
  end if;

  perform set_config('settlr.restoring', 'on', true);
  insert into public.expenses select * from jsonb_populate_record(null::public.expenses, snap->'expense');
  insert into public.expense_splits select * from jsonb_populate_recordset(null::public.expense_splits, snap->'splits');
  insert into public.expense_comments select * from jsonb_populate_recordset(null::public.expense_comments, snap->'comments');
  perform set_config('settlr.restoring', 'off', true);

  perform private.log_activity(gid, 'restored', case when snap->'expense'->>'type' = 'payment' then 'payment' else 'expense' end, eid,
    jsonb_build_object('after', snap->'expense'));
  return eid;
end;
$$;

revoke all on function public.restore_deleted_expense(uuid) from public, anon;
grant execute on function public.restore_deleted_expense(uuid) to authenticated;
revoke all on function private.log_activity(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.entry_summary(public.expenses) from public, anon;
grant execute on function private.entry_summary(public.expenses) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates for the new tables
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['expense_comments', 'activity_log'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
