# Running your own settlr

This covers everything outside the code that has to be set up for a working copy: the database, sign-in, deployment and the optional extras.

## 1. Create the backend

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in `supabase/migrations/`, oldest first, with `supabase db push` or by running each file in the SQL editor. The first file is a baseline of the whole schema, so a fresh project needs all of them. See `supabase/README.md` for how the database is organised.
3. In `src/supabase.js`, replace the project URL and publishable key with yours (Project settings → API). The publishable key is designed to ship to browsers; row-level security protects the data.

## 2. Sign-in

People can sign in with Google or with a 6-digit code emailed to them. Sign-ins with the same verified email land in the same account.

**Google:** enable the provider under **Authentication → Sign In / Providers** and add your OAuth client ID and secret.

**Redirect URLs:** under **Authentication → URL Configuration**, set the Site URL to wherever you host the app and add it, plus `http://localhost:5173` for local development, to the Redirect URLs.

**Email codes** need two more things:

1. Put the code in the emails. Under **Authentication → Emails → Templates**, edit both **Magic Link** and **Confirm signup** so the body includes the code, for example:

   ```html
   <h2>Your settlr code</h2>
   <p>Enter this code in settlr: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>. The code works for an hour.</p>
   ```

2. Send email through a real mail service. Supabase's built-in sender only delivers to your team's own addresses, a few an hour. Under **Authentication → Emails → SMTP Settings**, add a provider such as Resend, Postmark or Amazon SES.

## 3. Hosting

The included workflow (`.github/workflows/ci.yml`) publishes to GitHub Pages. In your repository, set **Settings → Pages → Source** to **GitHub Actions**. The build uses relative asset paths, so it works at any URL path. Any static host works too: run `npm run build` and serve `dist/`.

## 4. Crash reporting (optional)

Errors are sent to [Sentry](https://sentry.io), identified by account ID only (no names or emails). Uncaught errors are reported automatically, and so are failures the app catches and shows (see `src/monitoring.js`). It's off until a DSN is set.

1. Create a Sentry **Browser JavaScript** project and copy its DSN.
2. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add a repository variable `SENTRY_DSN`. The DSN isn't secret: it only allows sending events.
3. The next deploy switches it on. To try it locally, put `VITE_SENTRY_DSN=...` in `.env.local`.

Builds include public source maps, so stack traces point at the real source files.

## 5. Push notifications (optional)

Nudges and the weekly summary come from the `push` Edge Function. Deploy it with `supabase functions deploy push`. The VAPID key pair is generated on first use, so there's no secret to set by hand. The migrations schedule the weekly job with `pg_cron`; enable that extension if the migration warns that it couldn't. Details are in `supabase/README.md`.
