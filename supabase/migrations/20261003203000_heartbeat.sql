-- A function that does nothing but report the time. A scheduled GitHub Action
-- (.github/workflows/keepalive.yml) calls it through the API twice a week, so
-- the project always has recent API and database activity and Supabase's free
-- plan doesn't pause it for inactivity. It reads nothing from any table and
-- writes nothing, so letting anyone with the publishable key call it is harmless.

create or replace function public.heartbeat()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke all on function public.heartbeat() from public;
grant execute on function public.heartbeat() to anon, authenticated;
