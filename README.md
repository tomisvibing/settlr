# settlr

Split shared expenses without the maths.

settlr is a small web app, installable on a phone's home screen, for keeping track of who paid for what in a group and who owes whom.

## Features

- **Groups and invites:** share a link to bring people in, archive a group when it's done, and leave once you're square.
- **Adding expenses:** type a sentence, use the keypad or speak it, then split equally, by shares or by exact amounts.
- **Other currencies:** spend in another currency and settlr converts it at the day's exchange rate. Balances stay in the group's currency.
- **Receipts:** attach photos or PDFs to an expense.
- **Recurring expenses:** schedule rent and bills once and settlr adds them for you.
- **Settling up:** see the fewest payments that clear the group, and open a Monzo, PayPal or Revolut link to pay.
- **Nudges and updates:** gentle reminders to people who owe you, a weekly summary, and live updates when someone else changes something.
- **History:** every add, edit and delete is logged, and deleted expenses can be restored.
- **Your data:** export a group as CSV, or delete your account.

## Tech

Plain JavaScript modules built with [Vite](https://vite.dev), with [Supabase](https://supabase.com) providing sign-in, the Postgres database, file storage, realtime updates and one Edge Function. Exchange rates come from [Frankfurter](https://frankfurter.dev). Crash reporting with [Sentry](https://sentry.io) is optional.

## Getting started

You need Node 22 or newer and a Supabase project.

```sh
npm install
npm run dev      # local server with hot reload
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # production build in dist/
```

The app talks to the Supabase project set in `src/supabase.js`. To run your own copy, create a project, apply the migrations and swap in your project's URL and publishable key. [docs/self-hosting.md](docs/self-hosting.md) walks through it.

## Project layout

- `src/`: the app. Views, dialogs and the features that sit behind them are in their own folders.
  - `src/lib/`: pure logic (money maths, splitting, settle-up, exchange rates, formatting, CSV, voice parsing), each with unit tests in `test/`
  - `src/views/`: the screens
  - `src/dialogs/`: the add and edit sheets
- `public/`: web manifest, icons and the service worker
- `supabase/`: database migrations and the push-notification Edge Function (see [supabase/README.md](supabase/README.md))
- `test/`: Vitest unit tests
- `scripts/`: helper scripts. After changing `src/lib/ledger.js`, `story.js` or `format.js`, run `npm run sync-functions` to copy them into the Edge Function. A test fails until you do.
- `ROADMAP.md`: what's shipped and what's next

## Deploying

Every push to `main` runs lint, tests and the build, then publishes `dist/` to GitHub Pages (`.github/workflows/ci.yml`). Pull requests run the same checks without deploying. Setup for sign-in emails, crash reporting and push notifications is in [docs/self-hosting.md](docs/self-hosting.md).
