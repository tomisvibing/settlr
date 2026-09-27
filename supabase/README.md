# Database

settlr runs on Supabase (project `ctlldbpdtohalfcwkjwq`, eu-west-1).

`migrations/` holds the database schema: tables, row-level security policies and the RPCs the app calls.

- `20260927000000_baseline.sql` records the live database as it was when migrations started being tracked. The live project already has it, so don't run it there. Use it to build a fresh project or a local `supabase start`.
- Every later change goes in a new file named `YYYYMMDDHHMMSS_what_it_does.sql`, reviewed in a PR, then applied to the live project.
