-- Dompet — cloud schema
--
-- Run this once against a new Supabase project (SQL Editor, or `psql`).
-- It is written to be re-runnable: every statement is guarded.
--
-- Shape notes:
--   * The primary key is (user_id, id), not id. The app generates some ids
--     deterministically -- built-in categories are 'cat-income', 'cat-bills',
--     and a budget is '<month>:<categoryId>' -- so two users produce colliding
--     ids by design. Scoping the key by user is what makes that safe.
--   * Money is bigint, never numeric or float: the client works in whole
--     Rupiah and that discipline has to survive the round trip.
--   * updated_at drives last-write-wins; deleted_at is a tombstone, because a
--     row that simply vanished cannot tell another device it was deleted.
--   * Foreign keys are DEFERRABLE INITIALLY DEFERRED so one push transaction
--     can upsert rows in any order without tripping over its own ordering.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- accounts
-- --------------------------------------------------------------------------
create table if not exists public.accounts (
  user_id         uuid        not null default auth.uid() references auth.users on delete cascade,
  id              text        not null,
  name            text        not null check (length(name) between 1 and 120),
  type            text        not null check (type in ('salary','spending','savings','insurance_emoney','investment')),
  initial_balance bigint      not null default 0,
  color           text        not null,
  archived        boolean     not null default false,
  sort_order      integer     not null default 0,   -- "order" is reserved
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null,
  deleted_at      timestamptz,
  primary key (user_id, id)
);

-- --------------------------------------------------------------------------
-- categories / subcategories
-- --------------------------------------------------------------------------
create table if not exists public.categories (
  user_id      uuid        not null default auth.uid() references auth.users on delete cascade,
  id           text        not null,
  name         text        not null check (length(name) between 1 and 120),
  kind         text        not null check (kind in ('income','bills','expense','savings','investment','transfer')),
  is_built_in  boolean     not null default false,
  color        text        not null,
  sort_order   integer     not null default 0,
  updated_at   timestamptz not null,
  deleted_at   timestamptz,
  primary key (user_id, id)
);

create table if not exists public.subcategories (
  user_id      uuid        not null default auth.uid() references auth.users on delete cascade,
  id           text        not null,
  category_id  text        not null,
  name         text        not null check (length(name) between 1 and 120),
  is_built_in  boolean     not null default false,
  sort_order   integer     not null default 0,
  updated_at   timestamptz not null,
  deleted_at   timestamptz,
  primary key (user_id, id),
  constraint subcategories_category_fk
    foreign key (user_id, category_id) references public.categories (user_id, id)
    on delete cascade deferrable initially deferred
);

-- --------------------------------------------------------------------------
-- transactions
-- --------------------------------------------------------------------------
create table if not exists public.transactions (
  user_id         uuid        not null default auth.uid() references auth.users on delete cascade,
  id              text        not null,
  date            date        not null,
  month           text        not null check (month ~ '^\d{4}-\d{2}$'),
  type            text        not null check (type in ('income','expense','transfer')),
  -- Amounts are always positive; direction comes from `type`.
  amount          bigint      not null check (amount >= 0),
  account_id      text        not null,
  to_account_id   text,
  category_id     text        not null,
  subcategory_id  text,
  note            text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null,
  deleted_at      timestamptz,
  primary key (user_id, id),
  -- The denormalised month must agree with the date it was derived from.
  constraint transactions_month_matches_date check (month = to_char(date, 'YYYY-MM')),
  constraint transactions_account_fk
    foreign key (user_id, account_id) references public.accounts (user_id, id)
    deferrable initially deferred,
  constraint transactions_to_account_fk
    foreign key (user_id, to_account_id) references public.accounts (user_id, id)
    deferrable initially deferred,
  constraint transactions_category_fk
    foreign key (user_id, category_id) references public.categories (user_id, id)
    deferrable initially deferred,
  constraint transactions_subcategory_fk
    foreign key (user_id, subcategory_id) references public.subcategories (user_id, id)
    deferrable initially deferred
);

-- --------------------------------------------------------------------------
-- budgets
-- --------------------------------------------------------------------------
create table if not exists public.budgets (
  user_id      uuid        not null default auth.uid() references auth.users on delete cascade,
  id           text        not null,
  month        text        not null check (month ~ '^\d{4}-\d{2}$'),
  category_id  text        not null,
  amount       bigint      not null check (amount >= 0),
  rollover     boolean     not null default false,
  updated_at   timestamptz not null,
  deleted_at   timestamptz,
  primary key (user_id, id),
  constraint budgets_one_per_category_per_month unique (user_id, month, category_id),
  constraint budgets_category_fk
    foreign key (user_id, category_id) references public.categories (user_id, id)
    on delete cascade deferrable initially deferred
);

-- --------------------------------------------------------------------------
-- split bills
--
-- `people` and `items` stay jsonb: they are value objects belonging to one
-- bill, never queried across bills, and never referenced from elsewhere.
-- --------------------------------------------------------------------------
create table if not exists public.split_bills (
  user_id               uuid        not null default auth.uid() references auth.users on delete cascade,
  id                    text        not null,
  title                 text        not null default '',
  date                  date        not null,
  people                jsonb       not null default '[]'::jsonb,
  items                 jsonb       not null default '[]'::jsonb,
  tax_percent           numeric(6,3) not null default 0,
  service_percent       numeric(6,3) not null default 0,
  discount              bigint      not null default 0 check (discount >= 0),
  payer_id              text        not null default '',
  linked_transaction_id text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null,
  deleted_at            timestamptz,
  primary key (user_id, id),
  constraint split_bills_people_is_array check (jsonb_typeof(people) = 'array'),
  constraint split_bills_items_is_array check (jsonb_typeof(items) = 'array')
);

-- --------------------------------------------------------------------------
-- Indexes
--
-- Every sync pull is "my rows, changed since X", so that is the index every
-- table gets. Nothing else is queried server-side.
-- --------------------------------------------------------------------------
create index if not exists accounts_sync_idx      on public.accounts      (user_id, updated_at);
create index if not exists categories_sync_idx    on public.categories    (user_id, updated_at);
create index if not exists subcategories_sync_idx on public.subcategories (user_id, updated_at);
create index if not exists transactions_sync_idx  on public.transactions  (user_id, updated_at);
create index if not exists budgets_sync_idx       on public.budgets       (user_id, updated_at);
create index if not exists split_bills_sync_idx   on public.split_bills   (user_id, updated_at);
