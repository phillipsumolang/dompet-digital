-- Dompet — row-level security
--
-- Read this as the whole security model, because it is.
--
-- The publishable key ships inside the JavaScript bundle: it is public by
-- design, and anyone can read it out of the deployed site and talk to the API
-- directly. Nothing else stands between a stranger and this data. If a table
-- is missing from this file, or a policy is wrong, every user's finances are
-- readable by anyone.
--
-- So: every table gets RLS enabled AND forced, and one policy scoping all four
-- operations to the row's owner. `with check` matters as much as `using` --
-- without it a user could insert or update rows carrying someone else's
-- user_id.
--
-- Run after schema.sql. Re-runnable.

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'subcategories', 'transactions', 'budgets', 'split_bills'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- FORCE applies the policies to the table owner too, so a mistake
    -- elsewhere cannot quietly bypass them.
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_only', t);
    execute format($f$
      create policy %I on public.%I
        for all
        to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_owner_only', t);

    -- Signed-out callers get nothing at all, rather than relying on the
    -- policy above evaluating auth.uid() to null.
    execute format('revoke all on public.%I from anon', t);

    -- Granted explicitly rather than inherited from the project's default
    -- privileges: the policies above are useless if the role cannot reach the
    -- table, and useless in the other direction if a default ever widens.
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t
    );
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- Verification
--
-- Run this after applying. Every table must come back with rls_enabled and
-- rls_forced true and exactly one policy. A table appearing with false, or
-- with zero policies, is an open door.
-- --------------------------------------------------------------------------
select
  c.relname                                  as table_name,
  c.relrowsecurity                           as rls_enabled,
  c.relforcerowsecurity                      as rls_forced,
  count(p.polname)                           as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;
