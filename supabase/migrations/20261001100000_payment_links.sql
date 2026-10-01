-- Payment links: each account can save its Monzo, PayPal and Revolut usernames, so whoever owes
-- them can open the app with the amount filled in. Keyed by login rather than by people row,
-- because one person can appear as several rows (their own contact and placeholders they claimed).

create table public.pay_handles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monzo      text check (monzo   ~ '^[A-Za-z0-9._-]{1,40}$'),
  paypal     text check (paypal  ~ '^[A-Za-z0-9._-]{1,40}$'),
  revolut    text check (revolut ~ '^[A-Za-z0-9._-]{1,40}$'),
  updated_at timestamptz not null default now()
);

alter table public.pay_handles enable row level security;

-- Readable by you, and by anyone who can see a person tied to your login (people in your groups).
create policy "read own or shared handles" on public.pay_handles for select to authenticated
  using (user_id = (select auth.uid())
      or exists (select 1 from public.people p where p.user_id = pay_handles.user_id and private.can_see_person(p.id)));
create policy "add own handles" on public.pay_handles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own handles" on public.pay_handles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own handles" on public.pay_handles for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.pay_handles from anon;
grant select, insert, update, delete on public.pay_handles to authenticated;
