-- Push notifications. Each phone or browser that switches notifications on saves its push
-- subscription here. The `push` Edge Function sends them: a Sunday-evening summary of who owes
-- what, and a ping when someone in a group nudges you about money you owe them.

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "read own subscriptions" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add own subscriptions" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "delete own subscriptions" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- The function's own state: its VAPID key pair (made on first use, so no secret has to be set by
-- hand) and when the weekly summary last went out. No policies: only the function's service role
-- can read or write it.
create table public.push_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.push_state enable row level security;
revoke all on public.push_state from anon, authenticated;

-- Nudges sent, so one person can't ping another more than once every 12 hours about a group.
create table public.push_nudges (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_person  uuid not null references public.people (id) on delete cascade,
  group_id   uuid not null references public.groups (id) on delete cascade,
  sent_at    timestamptz not null default now()
);
create index push_nudges_lookup_idx on public.push_nudges (from_user, to_person, group_id, sent_at desc);
create index push_nudges_to_person_idx on public.push_nudges (to_person);
create index push_nudges_group_id_idx on public.push_nudges (group_id);
alter table public.push_nudges enable row level security;
revoke all on public.push_nudges from anon, authenticated;

-- Sunday at 17:00 UTC (6pm in a British summer, 5pm in winter), ask the function to send the weekly
-- summary. The function sends it at most once every six days, so an extra call does nothing.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'settlr-weekly-summary',
  '0 17 * * 0',
  $$
  select net.http_post(
    url := 'https://ctlldbpdtohalfcwkjwq.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_j4g8-00VVfjHfK6q8QlIaw_QHzAfAzU'),
    body := jsonb_build_object('type', 'weekly')
  );
  $$
);
