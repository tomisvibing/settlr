-- The push Edge Function runs as service_role, which this project doesn't give table access by
-- default. Grant exactly what it uses: read the ledger to work out who owes whom, and keep its own
-- state, nudge log and subscriptions.
grant select on public.groups, public.group_members, public.expenses, public.expense_splits, public.people to service_role;
grant select, insert, update on public.push_state to service_role;
grant select, insert on public.push_nudges to service_role;
grant select, delete on public.push_subscriptions to service_role;
