# Vihanga's Expenses

A personal finance app for tracking spending and income in Sri Lankan rupees. It runs at **https://vihanga-expenses.web.app**.

- **Overview**: how much you've spent this month, whether you're on pace, what's left per day, the spending curve against last month, top categories, and upcoming bills
- **Transactions**: search, filter by type or category, monthly or all-time view, edit or delete with undo, CSV export
- **Budgets**: one overall monthly limit plus per-category limits, with suggestions from your 3-month average
- **Insights**: savings rate, category donut, 6-month income vs expenses, biggest changes against last month, spending by weekday
- **Settings**: recurring items (rent, subscriptions, salary) that post automatically each month, theme, data export
- **Import SMS**: paste HNB (or other bank) alerts, or send them from an iPhone Shortcut to `/import#sms=…`; amounts, places, dates and accounts are read, categories are guessed and learned, duplicates are skipped
- **Your own month dates** (e.g. 25 Sep – 24 Oct), leftover money carried over or saved, credit card spending and amounts owed
- Google sign-in, real-time sync across devices, offline support, light and dark themes, and an installable phone app (Add to Home Screen)

Try it with sample data at https://vihanga-expenses.web.app/?demo. Nothing you do in demo mode is saved.

## Stack

Vite · React 18 · TypeScript · React Router · Firebase Auth + Firestore · Recharts · Lucide icons

```
src/
  lib/          types, categories, money/date formatting, analytics, Firebase setup
  data/         store.tsx (auth, live Firestore data, actions), ui.tsx (month, sheet, toasts, theme), demo.ts
  components/   Shell (sidebar + tab bar), TransactionSheet, TxList, charts, small bits
  pages/        Overview, Transactions, Budgets, Insights, Settings, SignIn
```

### Data model (Firestore)

```
users/{uid}/transactions/{id}   { type, amount, categoryId, note, date: "YYYY-MM-DD", createdAt, recurringId? }
users/{uid}/recurring/{id}      { type, amount, categoryId, note, dayOfMonth, active, lastPosted: "YYYY-MM" }
users/{uid}/meta/settings       { displayName, monthlyBudget, budgets: { [categoryId]: number }, legacyImported }
```

`firestore.rules` lets each signed-in user read and write only their own `users/{uid}` data.

Data from the earlier single-page versions (`users/{uid}/expenses` or the browser's saved copy) is detected after sign-in, and the app offers a one-click import.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (add ?demo for sample data)
npm run build      # type-check and build into dist/
```

## Deploy

Every push to `main` builds the app and publishes it to the live site through GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`). Pull requests get a temporary preview link.

**One-time setup:** the workflow needs a `FIREBASE_SERVICE_ACCOUNT_VIHANGA_EXPENSES` secret. Run this once from the project folder:

```bash
bash scripts/setup-autodeploy.sh
```

The script signs you in to Firebase, publishes the site and security rules immediately, and connects GitHub, which adds the secret for you.

To deploy by hand at any time: `npm run deploy`.

**Firebase Console checklist:** Authentication → Sign-in method → **Google** enabled, and `vihanga-expenses.web.app` listed under Authorized domains (it is by default).
