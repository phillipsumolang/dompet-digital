#!/usr/bin/env bash
# Applies schema.sql and policies.sql to a throwaway Postgres in Docker, then
# attacks them. RLS is the entire security model of this app, so it is checked
# rather than assumed -- and checked before it ever reaches real data.
#
# Usage: supabase/verify.sh     (needs Docker running)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
container=dompet-pg-verify
image=postgres:17-alpine

cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "==> starting $image"
docker run -d --name "$container" -e POSTGRES_PASSWORD=verify "$image" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$container" pg_isready -q 2>/dev/null && break
  sleep 2
done

run() { docker exec -i -u postgres "$container" psql -X -q -v ON_ERROR_STOP=1 -f "/tmp/$1"; }
for f in stubs.sql rls.sql constraints.sql; do docker cp "$here/verify/$f" "$container:/tmp/" >/dev/null; done
for f in schema.sql policies.sql; do docker cp "$here/$f" "$container:/tmp/" >/dev/null; done

echo "==> applying schema and policies"
run stubs.sql >/dev/null
run schema.sql >/dev/null
policies=$(run policies.sql)
echo "$policies" | grep -E "^ (accounts|budgets|categories|split_bills|subcategories|transactions)"

if echo "$policies" | grep -qE "\| f +\||\| +0$"; then
  echo "FAIL: a table has RLS disabled or no policy" >&2
  exit 1
fi

echo "==> attacking it"
{ run rls.sql; run constraints.sql; } 2>&1 | grep -oE "(PASS|FAIL) .*" | sed 's/^/    /'

echo "==> done"
