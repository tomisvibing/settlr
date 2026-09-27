-- settlr: let a signed-in user permanently delete their own account.
--
-- Run this once in the Supabase dashboard (SQL Editor → New query → Run).
-- It is safe to re-run: it only (re)creates the function.
--
-- What deleting an account does:
--   * Groups where nobody else has signed in are deleted with all their
--     expenses and splits.
--   * Groups shared with at least one other signed-in person are kept so
--     their balances stay correct. Ownership of the group, and of any
--     contacts it needs, passes to another signed-in member. The leaving
--     user's name stays on past expenses, but it's no longer linked to a
--     login (so it becomes a placeholder someone could claim again).
--   * Contacts and standalone settlements that nothing shared needs are deleted.
--   * Finally the auth user itself is deleted.
--
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

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
