begin;
insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

-- A push writes rows in whatever order the tables happen to come in. The FKs
-- must not care, as long as the transaction ends up consistent.
do $$
begin
  insert into public.transactions (id, date, month, type, amount, account_id, category_id, updated_at)
    values ('t1', '2026-09-05', '2026-09', 'expense', 250000, 'a1', 'c1', now());
  insert into public.accounts (id, name, type, color, updated_at)
    values ('a1', 'Bank', 'salary', 's1', now());
  insert into public.categories (id, name, kind, color, updated_at)
    values ('c1', 'Expenses', 'expense', 's3', now());
  raise notice 'PASS  child rows may be written before their parents';
exception when others then
  raise notice 'FAIL  out-of-order insert rejected: %', sqlerrm;
end $$;

-- But a genuinely orphaned row must still be refused at commit time.
do $$
begin
  insert into public.transactions (id, date, month, type, amount, account_id, category_id, updated_at)
    values ('t2', '2026-09-05', '2026-09', 'expense', 1000, 'ghost', 'c1', now());
  set constraints all immediate;
  raise notice 'FAIL  orphaned transaction accepted';
exception when foreign_key_violation then
  raise notice 'PASS  orphaned transaction refused';
end $$;
rollback;

-- Data constraints
insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.accounts (id, name, type, color, updated_at) values ('a1','Bank','salary','s1',now());
insert into public.categories (id, name, kind, color, updated_at) values ('c1','Expenses','expense','s3',now());

do $$
begin
  insert into public.transactions (id, date, month, type, amount, account_id, category_id, updated_at)
    values ('bad-month', '2026-09-05', '2026-08', 'expense', 100, 'a1', 'c1', now());
  raise notice 'FAIL  month may disagree with date';
exception when check_violation then
  raise notice 'PASS  month must agree with date';
end $$;

do $$
begin
  insert into public.transactions (id, date, month, type, amount, account_id, category_id, updated_at)
    values ('neg', '2026-09-05', '2026-09', 'expense', -1, 'a1', 'c1', now());
  raise notice 'FAIL  negative amount accepted';
exception when check_violation then
  raise notice 'PASS  amount cannot be negative';
end $$;

do $$
begin
  insert into public.transactions (id, date, month, type, amount, account_id, category_id, updated_at)
    values ('badtype', '2026-09-05', '2026-09', 'refund', 100, 'a1', 'c1', now());
  raise notice 'FAIL  unknown transaction type accepted';
exception when check_violation then
  raise notice 'PASS  transaction type is constrained';
end $$;

do $$
begin
  insert into public.budgets (id, month, category_id, amount, updated_at) values ('b1','2026-09','c1',1000,now());
  insert into public.budgets (id, month, category_id, amount, updated_at) values ('b2','2026-09','c1',2000,now());
  raise notice 'FAIL  two budgets for the same category in one month';
exception when unique_violation then
  raise notice 'PASS  one budget per category per month';
end $$;
rollback;
