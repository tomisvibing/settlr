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
- `src/views/`: the Home, Group, People and Settings pages
- `src/dialogs/`: add and edit dialogs
- `src/auth.js`, `src/data.js`, `src/router.js`, `src/events.js`: sign-in, loading data, hash routing, click handling
- `public/`: manifest and icons, copied into the build as-is
- `supabase/migrations/`: the database schema (see `supabase/README.md`)

## Deploying

Every push to `main` runs lint, tests and the build, then publishes `dist/` to GitHub Pages (`.github/workflows/ci.yml`). Pull requests run the same checks without deploying.
