-- Minimal stand-ins for the pieces Supabase provides, so the app's SQL can be
-- validated against a real Postgres.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create role anon;
create role authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
