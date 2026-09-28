# Database

settlr runs on Supabase (project `ctlldbpdtohalfcwkjwq`, eu-west-1).

`migrations/` holds the database schema: tables, row-level security policies and the RPCs the app calls.

- `20260927000000_baseline.sql` records the live database as it was when migrations started being tracked. The live project already has it, so don't run it there. Use it to build a fresh project or a local `supabase start`.
- Every later change goes in a new file named `YYYYMMDDHHMMSS_what_it_does.sql`, reviewed in a PR, then applied to the live project.

Supabase's migration history on the live project starts after the baseline, so it lists only the later files. Keep each file's timestamp equal to the version Supabase records when it's applied.

Receipts are stored in a private Storage bucket called `receipts`, at `<group id>/<file id>.<ext>`. The Storage policies let members of that group read, add and delete them, using the same `is_member` check as expenses. The app deletes a receipt's file when its expense or group is deleted.

The membership helpers the security rules use (`is_member`, `my_group_ids`, `can_see_person`) live in a `private` schema. The REST API doesn't expose that schema, so the app can't call them directly.
