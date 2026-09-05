-- Dompet — proving the isolation, rather than assuming it
--
-- RLS is the only thing standing between a stranger and this data, so it is
-- checked by attacking it: two users, and every way one might reach the
-- other's rows.
--
-- Run by ../verify.sh against a throwaway Postgres, NOT against Supabase --
-- it inserts into auth.users, which only the local stub allows. The live
-- project is checked from the client instead; see ../README.md.
--
-- Every line of output must read PASS.

begin;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict do nothing;

create or replace procedure act_as(uid text) language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claim.sub = %L', uid);
end $$;

-- --- Alice writes her own rows -------------------------------------------
call act_as('11111111-1111-1111-1111-111111111111');
insert into public.accounts (id, name, type, color, updated_at)
  values ('a-alice', 'Alice Bank', 'salary', 's1', now());
insert into public.categories (id, name, kind, color, updated_at)
  values ('cat-income', 'Income', 'income', 's1', now());

-- --- Bob writes his, reusing the SAME ids on purpose ----------------------
reset role;
call act_as('22222222-2222-2222-2222-222222222222');
insert into public.accounts (id, name, type, color, updated_at)
  values ('a-alice', 'Bob Bank', 'salary', 's2', now());
insert into public.categories (id, name, kind, color, updated_at)
  values ('cat-income', 'Income', 'income', 's1', now());

-- --- Now attack, as Alice ------------------------------------------------
reset role;
call act_as('11111111-1111-1111-1111-111111111111');

select case when count(*) = 1 and min(name) = 'Alice Bank'
            then 'PASS  select sees only my own rows'
            else 'FAIL  select leaked ' || count(*) || ' rows' end
from public.accounts;

select case when count(*) = 0
            then 'PASS  cannot see another user by filtering for them'
            else 'FAIL  filtering by user_id exposed ' || count(*) || ' rows' end
from public.accounts where user_id = '22222222-2222-2222-2222-222222222222';

do $$
begin
  insert into public.accounts (user_id, id, name, type, color, updated_at)
    values ('22222222-2222-2222-2222-222222222222', 'planted', 'Planted', 'salary', 's1', now());
  raise notice 'FAIL  inserted a row owned by someone else';
exception when insufficient_privilege then
  raise notice 'PASS  cannot insert a row owned by someone else';
end $$;

do $$
declare n integer;
begin
  update public.accounts set name = 'Owned' where id = 'a-alice'
    and user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  raise notice '%  update of another user''s row touched % rows',
    case when n = 0 then 'PASS ' else 'FAIL' end, n;
end $$;

do $$
declare n integer;
begin
  delete from public.accounts where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  raise notice '%  delete of another user''s rows touched % rows',
    case when n = 0 then 'PASS ' else 'FAIL' end, n;
end $$;

do $$
begin
  update public.accounts set user_id = '22222222-2222-2222-2222-222222222222'
    where id = 'a-alice';
  raise notice 'FAIL  handed a row to another user';
exception when insufficient_privilege then
  raise notice 'PASS  cannot hand a row to another user';
end $$;

-- --- And as a signed-out caller ------------------------------------------
reset role;
set local role anon;
do $$
begin
  perform 1 from public.accounts;
  raise notice 'FAIL  signed-out caller can read the table';
exception when insufficient_privilege then
  raise notice 'PASS  signed-out caller is refused outright';
end $$;

rollback;
