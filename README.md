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
- `src/lib/`: pure logic with unit tests in `test/` (money maths and splitting, settle-up, formatting, CSV, voice parsing)
- `src/views/`: the Home, Group, People, Activity and You (settings) pages; `shared.js` has avatars, pills, icons and activity rows
- `src/dialogs/`: add and edit sheets (bottom sheets on phones, centred panels on desktop); `expense.js` is the add-expense sheet with its keypad
- `src/auth.js`, `src/data.js`, `src/router.js`, `src/events.js`: sign-in, loading data, hash routing, click handling
- `public/`: manifest and icons, copied into the build as-is
- `supabase/migrations/`: the database schema (see `supabase/README.md`)

## Crash reporting

Errors people hit are sent to [Sentry](https://sentry.io), identified by account ID only (no names or emails). Uncaught errors are reported automatically, and so are failures the app catches and shows: loading data, background refreshes and saves (see `src/monitoring.js`).

It's off until a DSN is set:
1. Create a free Sentry account and a **Browser JavaScript** project, then copy its DSN.
2. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add a repository variable `SENTRY_DSN` with that value. The DSN isn't secret: it only allows sending events.
3. The next deploy switches it on. To try it locally, put `VITE_SENTRY_DSN=...` in `.env.local`.

Builds include public source maps, so stack traces in Sentry point at the real source files.

## Deploying

Every push to `main` runs lint, tests and the build, then publishes `dist/` to GitHub Pages (`.github/workflows/ci.yml`). Pull requests run the same checks without deploying.
