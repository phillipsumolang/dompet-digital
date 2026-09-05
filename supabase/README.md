# Cloud setup

The app works with no account at all; this is only needed for syncing.

## Checking the policies before they touch real data

```bash
supabase/verify.sh      # needs Docker running
```

It applies `schema.sql` and `policies.sql` to a throwaway Postgres and then
attacks them: reading another user's rows, filtering by their id, inserting a
row owned by them, updating and deleting their rows, reassigning ownership, and
reading while signed out. It also checks the data constraints and that a sync
push may write rows in any order. Thirteen checks, all of which must say PASS;
the script exits non-zero otherwise, and CI runs it on every push.

This uses a local stand-in for `auth.uid()`, so it validates the *policies*, not
the live project. Check the real one from the client instead: sign in as one
account, and confirm a query for the other account's rows returns nothing.

## One-time setup

1. Create a project at [supabase.com](https://supabase.com). Any region near
   you; the free tier is far more than this app needs.
2. SQL Editor → run **`schema.sql`**, then **`policies.sql`**.
3. Check the table that `policies.sql` prints at the end. Every row must read
   `rls_enabled = true`, `rls_forced = true`, `policies = 1`. Anything else
   means the data is reachable by anyone — stop and fix it before going on.
4. Authentication → Providers: enable **Email**, and **Google** if wanted
   (Google needs an OAuth client ID and secret from Google Cloud Console).
5. Authentication → URL Configuration → add the redirect URLs:
   - `http://localhost:5173/**` for development
   - `https://phillipsumolang.github.io/dompet-digital/**` for the deployed site
6. Settings → API: copy the **Project URL** and the **publishable / anon key**.

## Wiring the app to it

Development — `.env.local` in the repo root (git-ignored):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Deployment — the same two as repository **variables** (Settings → Secrets and
variables → Actions → Variables). They are not secrets: both end up in the
JavaScript bundle either way, because the browser has to hold them. Variables
rather than secrets keeps them readable and rotatable, and stops anyone
mistaking them for something that is protecting the data.

**What is protecting the data is `policies.sql`, and nothing else.** The secret
`service_role` key bypasses RLS entirely and must never appear in this repo, in
the bundle, or in a GitHub variable.

## Free tier

Projects **pause after a week with no requests** and need a manual unpause from
the dashboard. The app is local-first, so a paused project means syncing stops
and everything else keeps working — but it does mean a device that has been
away for a while will not catch up until the project is woken.
