# Dompet

A personal financial tracker that runs entirely in the browser. No account, no
server, no analytics — your data lives in this device's IndexedDB and leaves it
only when you export it yourself.

Built with Vite + React + TypeScript, in Rupiah.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Type-check and build to `dist/` (static files — host them anywhere) |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest over the money, date, aggregation, budget, split and export logic |
| `npm run lint` | oxlint |

Deploying is copying `dist/` to any static host. There is no backend to run.
The app uses client-side routing, so the host must send unknown paths to the
app rather than to a 404 page. Config for the three common hosts is committed:

| Host | How |
|---|---|
| **GitHub Pages** | `.github/workflows/deploy.yml` builds on every push to `main`. `VITE_BASE` sets the sub-path and `404.html` (a copy of `index.html`) makes deep links boot the app. |
| **Vercel** | `vercel.json` — rewrite everything to `/index.html` |
| **Netlify** | `netlify.toml` — the same rule as a 200 redirect |

Building for a sub-path locally: `VITE_BASE=/dompet-digital/ npm run build:pages`.

## The pages

| Page | What it is for |
|---|---|
| **Dashboard** | The month at a glance: income, expenses, savings, investments, net balance, where the money went, top spending, the year's trend, account balances |
| **Transactions** | Add, edit, search and filter every entry |
| **Analytics** | Monthly or yearly: category distribution, expense breakdown, savings rate, quick stats, and what changed against last month |
| **Budget** | A limit per category, with rollover and one-click copying from last month |
| **Reports** | Monthly, yearly or a custom range, plus Excel export |
| **Accounts** | Banks, wallets and brokerages, with derived balances |
| **Categories** | Six built-in groups with subcategories, plus your own |
| **Split Bill** | Who owes what, to the exact Rupiah |

## How it is put together

```
src/
  db/       schema, Dexie setup, seed data, mutations, backup/restore
  lib/      money, dates, aggregation, budget and split maths (pure, tested)
  hooks/    live queries over IndexedDB
  components/  layout, ui primitives, charts, transaction form and list
  pages/    the eight routes
  export/   Excel workbook building
```

A few decisions worth knowing before changing anything:

**Money is integers.** Every amount is a whole number of Rupiah and always
positive; direction comes from `Transaction.type`. Floats are never used for
money — the drift they introduce is invisible until the totals are wrong.

**Balances are derived, never stored.** `initialBalance + in − out`, computed in
`lib/finance.ts`. A stored balance goes stale the first time a transaction is
edited or deleted.

**Category *kind* drives every total.** Savings and investments leave the wallet
but are not spending — they are money moved to your own other accounts — so they
get their own tiles and stay out of "Expenses". Transfers are excluded from
every total; they only move balance between accounts. Set a transaction's
*To account* and the receiving account's balance grows.

**Everything reads through `useLiveQuery`.** Dexie re-runs the queries that
touched a changed table, so a transaction saved in a modal updates the dashboard
behind it. There is no global store for domain data and nothing to invalidate.

**Chart colours are stored as slot tokens (`s1`…`s8`), not hex.** They resolve to
a light or dark step at render time, from a palette validated for contrast and
colour-blind separation in both modes (`lib/palette.ts`). Charts cap at seven
identities plus "Other" rather than inventing an eighth hue.

**The heavy dependencies are lazy.** Recharts, the Excel writer and the Zod
restore schema each load only when something needs them, keeping the initial
bundle to what the dashboard actually uses.

## Backing up

There is no server, so **clearing your browser data deletes everything.** Use
*Data → Back up to JSON* in the top bar; *Restore* replaces the whole database
with a file's contents after validating it, inside a single transaction, so a
bad file cannot leave things half-written.

## Not included

Receipt scanning (needs OCR and a server), multi-device sync, authentication,
multi-currency and recurring transactions. The persistence layer is confined to
`src/db/` and `src/hooks/`, so adding a sync backend later would not touch the
pages.
