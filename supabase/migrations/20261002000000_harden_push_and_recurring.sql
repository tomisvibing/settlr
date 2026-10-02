-- Findings from a review of the push function and recurring expenses.
--
-- 1. The weekly push job had no check on who called it, so anyone could trigger it early and use up
--    the week's send. The job now sends a secret kept in push_state, which only the function and
--    the database itself can read.
-- 2. push_subscriptions took any text as an endpoint. It must be an https address.
-- 3. One bad schedule row (a split key that isn't a person id, say) made run_recurring_expenses fail
--    for every group, and a schedule starting long ago added hundreds of entries in one run. Each
--    schedule now runs on its own, so a failure skips only that one, and each adds at most 100 a
--    day (it carries on the next day).

-- 1. The secret, made here so nothing has to be set by hand. Existing installs keep theirs.
insert into public.push_state (key, value)
values ('cron', jsonb_build_object('secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'settlr-weekly-summary';
select cron.schedule(
  'settlr-weekly-summary',
  '0 17 * * 0',
  $$
  select net.http_post(
    url := 'https://ctlldbpdtohalfcwkjwq.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_j4g8-00VVfjHfK6q8QlIaw_QHzAfAzU',
      'x-cron-secret', (select value->>'secret' from public.push_state where key = 'cron')
    ),
    body := jsonb_build_object('type', 'weekly')
  );
  $$
);

-- 2.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https check (endpoint ~ '^https://[^/]+/');

-- 3.
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
  added integer;
begin
  for r in
    select * from public.recurring_expenses s
    where (auth.uid() is null or private.is_member(s.group_id))
      and private.group_open(s.group_id)
    for update
  loop
    begin
      added := 0;
      loop
        due := private.recurring_due(r.start_date, r.frequency, r.runs);
        exit when due > current_date or (r.ends_on is not null and due > r.ends_on) or added >= 100;
        insert into public.expenses (group_id, type, description, amount_cents, paid_by, split_mode, split_input, expense_date)
        values (r.group_id, 'expense', r.description, r.amount_cents, r.paid_by, r.split_mode, r.split_input, due)
        returning id into eid;
        insert into public.expense_splits (expense_id, person_id, amount_cents)
        select eid, key::uuid, value::bigint from jsonb_each_text(r.splits);
        r.runs := r.runs + 1;
        added := added + 1;
      end loop;
      update public.recurring_expenses set runs = r.runs where id = r.id;
      made := made + added;
    exception when others then
      -- Undo this schedule's partial work and move on to the next one
      raise warning 'recurring expense % skipped: %', r.id, sqlerrm;
    end;
  end loop;
  return made;
end;
$$;
revoke all on function public.run_recurring_expenses() from public, anon;
grant execute on function public.run_recurring_expenses() to authenticated;
