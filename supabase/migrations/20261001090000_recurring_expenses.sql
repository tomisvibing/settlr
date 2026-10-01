-- Recurring expenses (rent, bills): a schedule that adds an expense on a
-- repeating date, run daily by pg_cron.
--
-- A schedule stores the finished split (`splits`, person -> amount) so each
-- occurrence is identical, plus `split_mode` / `split_input` so the entries it
-- creates can be edited like any other. Occurrence n falls on
-- start_date + n periods, counted from the start date, so a monthly bill
-- starting on the 31st lands on the 28th in February and the 31st again in
-- March. `runs` is how many have been added already.
--
-- Any member of an open group can add, stop or change a schedule. Entries
-- created by the schedule have no signed-in actor, so History shows them as
-- added by settlr.

create table if not exists public.recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  description  text not null,
  amount_cents bigint not null check (amount_cents > 0),
  paid_by      uuid not null references public.people (id),
  split_mode   text not null default 'equal',
  split_input  jsonb not null default '{}'::jsonb,
  splits       jsonb not null default '{}'::jsonb,
  frequency    text not null check (frequency in ('weekly', 'fortnightly', 'monthly', 'yearly')),
  start_date   date not null,
  runs         integer not null default 0,
  ends_on      date,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists recurring_expenses_group_idx on public.recurring_expenses (group_id);

alter table public.recurring_expenses enable row level security;
revoke all on public.recurring_expenses from anon;
grant select, insert, update, delete on public.recurring_expenses to authenticated;

drop policy if exists "member read recurring" on public.recurring_expenses;
create policy "member read recurring" on public.recurring_expenses for select
  using (private.is_member(group_id));
drop policy if exists "member add recurring" on public.recurring_expenses;
create policy "member add recurring" on public.recurring_expenses for insert
  with check (private.is_member(group_id) and private.group_open(group_id) and created_by = (select auth.uid()));
drop policy if exists "member update recurring" on public.recurring_expenses;
create policy "member update recurring" on public.recurring_expenses for update
  using (private.is_member(group_id) and private.group_open(group_id))
  with check (private.is_member(group_id) and private.group_open(group_id));
drop policy if exists "member delete recurring" on public.recurring_expenses;
create policy "member delete recurring" on public.recurring_expenses for delete
  using (private.is_member(group_id) and private.group_open(group_id));

-- The date of occurrence n (0 is the start date itself).
create or replace function private.recurring_due(start_date date, frequency text, n integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case frequency
    when 'weekly'      then start_date + 7 * n
    when 'fortnightly' then start_date + 14 * n
    when 'monthly'     then (start_date + make_interval(months => n))::date
    else                    (start_date + make_interval(years => n))::date
  end;
$$;

-- Add every occurrence that has fallen due, catching up on any missed days.
-- pg_cron calls it with no signed-in user and covers every group; the app
-- calls it after a schedule is created, and then covers only the caller's
-- groups. Archived groups are skipped and catch up once restored.
create or replace function public.run_recurring_expenses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurring_expenses;
  due date;
  eid uuid;
  made integer := 0;
begin
  for r in
    select * from public.recurring_expenses s
    where (auth.uid() is null or private.is_member(s.group_id))
      and private.group_open(s.group_id)
    for update
  loop
    loop
      due := private.recurring_due(r.start_date, r.frequency, r.runs);
      exit when due > current_date or (r.ends_on is not null and due > r.ends_on);
      insert into public.expenses (group_id, type, description, amount_cents, paid_by, split_mode, split_input, expense_date)
      values (r.group_id, 'expense', r.description, r.amount_cents, r.paid_by, r.split_mode, r.split_input, due)
      returning id into eid;
      insert into public.expense_splits (expense_id, person_id, amount_cents)
      select eid, key::uuid, value::bigint from jsonb_each_text(r.splits);
      r.runs := r.runs + 1;
      made := made + 1;
    end loop;
    update public.recurring_expenses set runs = r.runs where id = r.id;
  end loop;
  return made;
end;
$$;
revoke all on function public.run_recurring_expenses() from public, anon;
grant execute on function public.run_recurring_expenses() to authenticated;

-- Daily at 00:05 UTC, where the pg_cron extension is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'settlr-recurring-expenses';
    perform cron.schedule('settlr-recurring-expenses', '5 0 * * *', 'select public.run_recurring_expenses()');
  else
    raise notice 'pg_cron is not available: enable it, then schedule public.run_recurring_expenses() daily';
  end if;
end;
$$;

-- Live updates.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recurring_expenses') then
    alter publication supabase_realtime add table public.recurring_expenses;
  end if;
end;
$$;
