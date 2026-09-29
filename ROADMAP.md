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
- [x] **Swipe** a row left for Edit and Delete (touch screens; on desktop, click a row to edit)
- [ ] **More polish**: a custom date picker (the phone's own is fine for now)
- [ ] **Sign in without Google**:
  - [x] email with a 6-digit code (needs the dashboard steps in the README before it works for everyone)
  - [ ] Sign in with Apple (needs an Apple Developer account, $99 a year)
  - [x] account linking: Supabase links sign-ins that share a verified email automatically

## Phase 2: Smart capture

- [x] **Receipts**: take a photo or upload an image or PDF, shrunk on the phone before upload, stored in Supabase Storage and visible only to the group, shown on the expense
- [ ] **Receipt reading**: Claude reads the photo and fills in merchant, total, date and line items
- [ ] **Split by item**: tap who had what from the scanned line items
- [ ] **AI voice parsing**: send the transcript and the group's member names to Claude and get back clean fields (description, amount, payer, split, date) to confirm in the form. Today's parser just keeps whatever words are left over, so the descriptions come out garbled.

Both AI features share one Supabase Edge Function, so the Claude API key never reaches the browser. The default model is Claude Opus 5 (reads images, returns structured output), at roughly 1–2p per receipt and under 1p per voice entry. Claude Haiku 4.5 costs about a fifth as much if cost matters more than accuracy.

## Phase 3: Using it together

- [ ] Live updates: see new expenses the moment someone adds them (Supabase Realtime)
- [ ] Change history ("Bob edited *Dinner*: £40 → £45") and undo for deletes
- [ ] Push notifications: "You owe Sam £20" reminders and a weekly summary
- [ ] Leave a group; admin role so only admins can delete a group
- [ ] Comments on expenses

## Phase 4: Money features

- [ ] Payment links: "Mark paid" opens Monzo.me, PayPal.me or Revolut with the amount filled in
- [ ] Multiple currencies: expenses in the local currency on trips, converted to the group's currency, and one overall total on Home
- [ ] Recurring expenses (rent, bills)
- [ ] Categories and insights: spending by group and month, trip totals, who paid most
- [ ] "Simplify debts" as a setting; archive finished groups

## Phase 5: Reach

- [ ] Offline support: open the app and queue entries without signal
- [ ] Import from Splitwise
- [ ] App Store and Play Store versions from the same code (Capacitor)
- [ ] Custom domain

## Suggested order

Phase 0 (migrations, then the Vite split), then the design mock-ups, then receipts and AI voice together since they share a server function.
