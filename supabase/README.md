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
