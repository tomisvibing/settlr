# Database

settlr runs on Supabase (project `ctlldbpdtohalfcwkjwq`, eu-west-1).

`migrations/` holds the database schema: tables, row-level security policies and the RPCs the app calls.

- `20260927000000_baseline.sql` records the live database as it was when migrations started being tracked. The live project already has it, so don't run it there. Use it to build a fresh project or a local `supabase start`.
- Every later change goes in a new file named `YYYYMMDDHHMMSS_what_it_does.sql`, reviewed in a PR, then applied to the live project.

Supabase's migration history on the live project starts after the baseline, so it lists only the later files. Keep each file's timestamp equal to the version Supabase records when it's applied.

Receipts are stored in a private Storage bucket called `receipts`, at `<group id>/<file id>.<ext>`. The Storage policies let members of that group read, add and delete them, using the same `is_member` check as expenses. The app deletes a receipt's file when its expense or group is deleted.

Each group member has a `role` (`admin` or `member`) and a `left_at`. Whoever creates a group is its admin. Only admins can delete a group, remove someone who has an account, or make others admins (`set_group_admin`); a group with no admin who has an account is run by all its members. Leaving (`leave_group`) needs a zero balance and keeps the member's row, so their name stays on the group's history while `my_group_ids` stops giving them access. An invite link brings them back.

Any member can archive a group (`groups.archived_at`) or restore it. While it's archived, `private.group_open` makes its expenses, splits and receipts read-only for everyone.

An expense or payment in another currency keeps `orig_currency`, `orig_amount_cents` and `fx_rate`; `amount_cents` is always in the group's currency, so balances never mix currencies. A group's currency is fixed once it has expenses (`lock_group_currency`).

`activity_log` is written only by triggers (entries added, edited and deleted; groups created, renamed, archived and restored; people joining, leaving and becoming admins) and is read-only for members. A deletion's log row keeps a full copy of the entry, its splits and comments, which `restore_deleted_expense` puts back. `expense_comments` are readable by the group and deletable by their author.

The app's tables are in the `supabase_realtime` publication, so the app gets live updates. Realtime applies the same row-level security as a normal read.

The membership helpers the security rules use (`is_member`, `my_group_ids`, `can_see_person`) live in a `private` schema. The REST API doesn't expose that schema, so the app can't call them directly.

## Recurring expenses

`recurring_expenses` holds schedules (rent, bills). Each stores the finished split, so every occurrence is identical, and occurrence n falls on `start_date` plus n periods (a monthly bill from the 31st lands on the 28th in February, then the 31st again). `run_recurring_expenses()` adds whatever has fallen due, catching up on missed days and skipping archived groups until they're restored. A pg_cron job runs it daily at 00:05 UTC (the migration schedules it when the extension is available; otherwise enable pg_cron and schedule it by hand), and the app calls it once after creating a schedule, when it covers only the caller's groups. The entries it adds have no signed-in actor, so History shows them as added by settlr.

## Payment links

`pay_handles` keeps each login's Monzo, PayPal and Revolut usernames (one row per `auth.users` id). Anyone who can see a person tied to that login can read them, and only the owner can change them. The app builds the links itself (`src/lib/paylinks.js`): Monzo with the amount in pounds, PayPal with the amount and currency, and Revolut without an amount, because its public links can't carry one.

## Push notifications

The `push` Edge Function (`functions/push/`) sends web push notifications to the devices in `push_subscriptions`:

- `{ "type": "key" }` returns the public VAPID key a browser subscribes with. The key pair is made on first use and kept in `push_state`, which has no policies, so only the function's service role can read it. No secret needs setting by hand.
- `{ "type": "nudge", "group_id", "person_id" }`, called by a signed-in member, tells someone who owes them in that group. It checks the caller is in the group and is owed by that person, allows one nudge per person per group every 12 hours (`push_nudges`), and does nothing for people without an account.
- `{ "type": "weekly" }` sends everyone with notifications on the overview's sentence ("Alex owes you £20.00 for Lisbon. You owe Sam €30.00."), skipping anyone who's square. A `pg_cron` job calls it on Sundays at 17:00 UTC; the function sends at most once every six days, so an extra call does nothing.

It reuses the app's `ledger.js`, `story.js` and `format.js` from copies in `functions/push/lib/`. After changing those files in `src/lib/`, run `npm run sync-functions` (a test fails until you do).

This project doesn't give `service_role` table access by default, so `20261001072704_push_function_grants.sql` grants the function exactly what it reads and writes. A new table the function uses needs a grant there too.

Deploy with `supabase functions deploy push` (the `verify_jwt = false` in `config.toml` matters: the app calls it with the publishable key, which isn't a JWT, and the function checks the signed-in user itself).
