-- Profile photos: people who signed in with Google show their Google photo to
-- everyone in their groups, instead of an initial.
--
-- The photo belongs to the account, not to a contact row, so it is written only
-- by public.set_my_avatar onto every people row that is the caller (their own
-- contact and any placeholders they claimed, which other people own). Nobody
-- can set or change anyone else's photo, and only Google's photo host is
-- accepted, so a photo can't be used to point people's browsers somewhere else.

alter table public.people
  add column avatar_url text
  constraint people_avatar_url_google
    check (avatar_url is null or (avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/' and length(avatar_url) <= 2048));

-- Ordinary inserts and updates leave the photo alone; a row that stops being
-- someone (account deleted, placeholder released) loses it.
create or replace function private.guard_avatar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('settlr.set_avatar', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.avatar_url := null;
    else
      new.avatar_url := old.avatar_url;
    end if;
  end if;
  if new.user_id is null then
    new.avatar_url := null;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_avatar() from public, anon, authenticated;

create trigger guard_avatar
  before insert or update on public.people
  for each row execute function private.guard_avatar();

create or replace function public.set_my_avatar(url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if url is not null and not (url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/' and length(url) <= 2048) then
    raise exception 'Unsupported photo address';
  end if;
  perform set_config('settlr.set_avatar', 'on', true);
  update public.people
     set avatar_url = url
   where user_id = auth.uid()
     and avatar_url is distinct from url;
  perform set_config('settlr.set_avatar', '', true);
end;
$$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
