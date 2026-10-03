# settlr roadmap

Where settlr is heading, roughly in order. Tick items off as they ship.

## Shipped

- [x] Home overview of all groups, with your overall balance and recent activity
- [x] Settings (cog icon): edit your name, sign out, theme, download your data
- [x] Delete account (the `delete_my_account` function, live in Supabase)
- [x] Back-button-friendly routing, invite links, group CSV export, activity search

## Phase 0: Foundations

Everything later builds on these.

- [x] Put the database setup (tables, security rules, functions) in the repo as migrations (`supabase/migrations/`), so every database change is reviewable
- [x] Fix what Supabase's security and performance checks flagged (`supabase/migrations/20260927213402_harden_functions_and_policies.sql`)
- [x] Split the single `index.html` into a small Vite project with modules, deployed to GitHub Pages by GitHub Actions
- [x] Automated tests for the balance and split maths (Vitest, run on every PR)
- [x] Error monitoring with Sentry, switched on by the `SENTRY_DSN` repository variable

## Phase 1: Look, feel and sign-in

- [x] **Design direction**: mocked up three, chose Pocket's layout with Ledger's look ([canvas](https://claude.ai/artifact/V8tdpBJY55XQg9rvP2fLue))
- [x] **UI rebuild** in the chosen direction, phone-first with a sidebar on wide screens:
  - bottom tab bar and a floating **+** button, plus a new Activity tab across all groups
  - "Add expense" as a bottom sheet with a big amount keypad (typing on desktop), avatar chips for who paid and who it's for
  - coloured avatars for people, and a proper icon set (no emoji)
  - every dialog a bottom sheet on phones and a centred panel on desktop
- [x] **UI polish**: in-app confirm sheets instead of the browser's pop-ups, loading placeholders, smooth page transitions
- [x] **Swipe** left for actions everywhere on touch screens: expenses and payments (Edit, Delete), group cards on Home (Edit, Archive, Delete for admins; Restore on archived ones), people who aren't in anything yet, and settlements
- [x] **Redesign** ([prototype](https://claude.ai/artifact/PwjSpyktQ4dnJz4szVqYxE)): espresso on cream with EB Garamond and a lavender pill:
  - a landing page that says *Split* over a spinning reel, with one Add an expense button
  - adding an expense as one editable sentence
  - the overview as a paragraph, with groups as tear-off tickets
  - who's up and who's down in words, the fewest payments with a Paid stamp, and spending printed as a till receipt
  - a membership card on Settings, with settings as sentences
- [ ] **More polish**: a custom date picker (the phone's own is fine for now)
- [x] **Sign in without Google**:
  - [x] email with a 6-digit code (needs the email sender set up in Supabase, see the README, before codes reach everyone)
  - [x] account linking: Supabase links sign-ins that share a verified email automatically

## Phase 2: Smart capture

- [x] **Receipts**: take a photo or upload an image or PDF, shrunk on the phone before upload, stored in Supabase Storage and visible only to the group, shown on the expense
- [x] **Better voice entry, no AI**: the voice screen asks for *what, how much, who paid, who for* with an example using the group's own names; it keeps listening through pauses (with a Done button); the description is just the first phrase, so "Yesterday we went for dinner at Nando's and it cost me £37" becomes *Dinner at Nando's*; it understands "I paid", "cost me" and "split with Sam"; and the form shows what it heard

## Phase 3: Using it together

- [x] Live updates: see new expenses the moment someone adds them (Supabase Realtime)
- [x] Change history ("Bob edited *Dinner*: £40 → £45") in each group's History sheet, with Undo after a delete and Restore for any deleted entry
- [x] Nudges: a Nudge beside each payment owed to you opens your phone's share sheet with a friendly message and the group's link, and, if you turn it on in You (never, by default; weekly, fortnightly or monthly), the overview lists who still owes you in groups that have gone quiet. Nothing is sent until you've read the message and said yes
- [x] Push notifications (switch on under Settings): a Sunday-evening summary of who owes what, and a notification when someone nudges you. Nudging someone with notifications on reaches them directly; anyone else gets the share-sheet message. On an iPhone they need settlr added to the Home Screen
- [x] Leave a group (once settled up); admin role so only admins can delete a group or remove someone with an account
- [x] Comments on expenses

## Phase 4: Money features

- [x] Payment links: add your Monzo, PayPal or Revolut username under Settings, and anyone who owes you gets "Pay with Monzo" beside the payment, with the amount filled in (Monzo for pounds; Revolut opens your page without an amount). Your link also goes in the nudges you send
- [x] 50 currencies to pick from, with names, and whole-number amounts for currencies without pence (yen, won, forint…)
- [x] Multiple currencies in one group: each expense or payment in any currency, converted into the group's at the European Central Bank rate for its date (or your own), keeping both amounts
- [ ] One overall total on Home in your own currency, across groups in different currencies
- [x] Recurring expenses (rent, bills): choose Repeats when adding an expense (weekly, fortnightly, monthly or yearly); a daily job adds each one when it falls due, and the group page lists them with a Stop
- [ ] Categories and insights: spending by group and month, trip totals, who paid most
- [x] Archive finished groups: frozen and read-only for everyone, kept under Archived on Home, and restorable by any member
- [ ] "Simplify debts" as a setting

## Phase 5: Reach

- [ ] Offline support: open the app and queue entries without signal

## Parked: needs something from outside the code

Not planned for now. Each one needs an account, a key, a file or a purchase before it can be built.

- **Receipt reading**: Claude reads the photo and fills in merchant, total, date and line items. *Needs an Anthropic API key.*
- **Split by item**: tap who had what from the scanned line items. *Needs receipt reading.*
- **AI voice parsing**: Claude turns the transcript into clean fields. *Needs an Anthropic API key.* The no-AI voice improvements above may be enough.
  - Both AI features would share one Supabase Edge Function so the key never reaches the browser, at roughly 1–2p per receipt and under 1p per voice entry.
- **Import from Splitwise**: upload the CSV Splitwise exports for each group, match its people to settlr's, and bring in every expense and payment (or connect to Splitwise's API for all groups at once). *Needs a real Splitwise export to build against, or a Splitwise developer app.*
- **Sign in with Apple**. *Needs an Apple Developer account, $99 a year.*
- **App Store and Play Store versions** from the same code (Capacitor). *Needs Apple and Google developer accounts.*
- **Custom domain**, which would also let sign-in emails come from settlr's own address. *Needs a domain, about £10 a year.*
