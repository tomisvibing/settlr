# settlr

Split shared expenses without the maths. Live at https://tomisvibing.github.io/settlr/.

A small web app (installable as a home-screen app) built with [Vite](https://vite.dev) and plain JavaScript modules, backed by [Supabase](https://supabase.com) for sign-in and data.

## Working on it

```sh
npm install
npm run dev      # local server with hot reload
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # production build in dist/
```

Google sign-in on `npm run dev` only works if `http://localhost:5173` is listed under Supabase → Authentication → URL Configuration → Redirect URLs.

## Layout

- `src/main.js`: entry point, wires everything up
- `src/lib/`: pure logic with unit tests in `test/` (money maths and splitting, settle-up, formatting, CSV, voice parsing, receipt paths and sizing)
- `src/views/`: the landing page with its one Add expense button (`start.js`), then Overview (`home.js`), Group, People, Activity and You (settings); `shared.js` has avatars, pills, icons and activity rows
- `src/dialogs/`: add and edit sheets (bottom sheets on phones, centred panels on desktop); `expense.js` is the add-expense sheet with its keypad
- `src/auth.js`, `src/data.js`, `src/router.js`, `src/events.js`: sign-in, loading data, hash routing, click handling
- `src/receipts.js`: shrinking, uploading and showing receipt photos and PDFs (Supabase Storage)
- `src/swipe.js`: swipe a row left for Edit and Delete on touch screens
- `src/rates.js`, `src/lib/fx.js`: exchange rates (Frankfurter, European Central Bank) and the conversion maths for spending in another currency
- `src/dialogs/history.js`, `src/lib/history.js`: a group's History sheet and the sentences it shows
- `src/live.js`: live updates (Supabase Realtime); reloads when anything in your groups changes, waiting until an open sheet closes
- `public/`: manifest and icons, copied into the build as-is
- `supabase/migrations/`: the database schema (see `supabase/README.md`)

## Signing in

People can sign in with Google, or with a 6-digit code emailed to them. Sign-ins with the same verified email land in the same account. Email codes need three things set in the Supabase dashboard:

1. **Put the code in the emails.** Under **Authentication → Emails → Templates**, edit both **Magic Link** and **Confirm signup** so the body includes the code, for example:

   ```html
   <h2>Your settlr code</h2>
   <p>Enter this code in settlr: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>. The code works for an hour.</p>
   ```

2. **Send email through a real mail service.** Supabase's built-in sender only delivers to your Supabase team's own addresses, a few an hour. Under **Authentication → Emails → SMTP Settings**, add a provider such as Resend, Postmark or Amazon SES (Resend's free tier is plenty for a small app).
3. **Allow the redirect.** Under **Authentication → URL Configuration**, make sure `https://tomisvibing.github.io/settlr/` is the Site URL or a Redirect URL. Google sign-in already needs this, so it's probably set.

## Crash reporting

Errors people hit are sent to [Sentry](https://sentry.io), identified by account ID only (no names or emails). Uncaught errors are reported automatically, and so are failures the app catches and shows: loading data, background refreshes and saves (see `src/monitoring.js`).

It's off until a DSN is set:
1. Create a free Sentry account and a **Browser JavaScript** project, then copy its DSN.
2. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add a repository variable `SENTRY_DSN` with that value. The DSN isn't secret: it only allows sending events.
3. The next deploy switches it on. To try it locally, put `VITE_SENTRY_DSN=...` in `.env.local`.

Builds include public source maps, so stack traces in Sentry point at the real source files.

## Deploying

Every push to `main` runs lint, tests and the build, then publishes `dist/` to GitHub Pages (`.github/workflows/ci.yml`). Pull requests run the same checks without deploying.
