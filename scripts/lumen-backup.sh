#!/usr/bin/env bash
# #999 Free-first: Supabase Free has no automatic backup. Weekly logical export
# of the Lumen data (progression, receipts, purchases, entitlements, privacy
# ledger) plus auth.users/auth.identities, then a restore check.
#
#   lumen-backup.sh dump   <source_url>  <work_dir>
#   lumen-backup.sh verify <work_dir>    <empty_restore_url>
#
# Never prints row contents, row counts, credentials or personal data: public
# workflow logs only show table names and pass/fail. lumen.analytics_events
# keeps its structure but not its rows (134 MB of optional historical
# telemetry, ~200 MB of egress per export otherwise).
set -euo pipefail

SCHEMAS=(lumen lumen_commands lumen_privacy)
counts_sql() {
  cat <<'SQL'
select format('%I.%I', n.nspname, c.relname) || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p')
  and (n.nspname in ('lumen','lumen_commands','lumen_privacy')
    or (n.nspname = 'auth' and c.relname in ('users','identities')))
  and not (n.nspname = 'lumen' and c.relname = 'analytics_events')
order by 1;
SQL
}

dump() {
  local src=$1 out=$2
  mkdir -p "$out"
  # Counts first: the dump that follows can only contain as many rows or more
  # (the job runs outside the retention windows at 03:17-04:13 UTC).
  psql "$src" -X -A -t -q -v ON_ERROR_STOP=1 -c "$(counts_sql)" > "$out/manifest.txt"
  [ -s "$out/manifest.txt" ] || { echo "backup: empty manifest" >&2; exit 1; }
  local args=(--format=custom --no-owner --no-privileges)
  for s in "${SCHEMAS[@]}"; do args+=(--schema="$s"); done
  pg_dump "$src" "${args[@]}" --exclude-table-data=lumen.analytics_events --file="$out/lumen.dump"
  pg_dump "$src" --format=custom --no-owner --no-privileges \
    --table=auth.users --table=auth.identities --file="$out/auth.dump"
  echo "backup: dump complete ($(wc -l < "$out/manifest.txt") tables)"
}

verify() {
  local out=$1 dst=$2
  # Minimal Supabase surroundings so the dumped tables can be created.
  psql "$dst" -X -q -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- Column defaults and policies may call the Supabase Auth helpers.
create or replace function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select null::text $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
do $$begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
SQL
  local log="$out/restore.log" status=0
  # Functions and triggers whose dependencies live outside the dump (public RPCs,
  # pg_net, vault) may fail to restore: they are rebuilt from the migrations.
  # Data is what a backup must guarantee, so any failed COPY fails the check.
  pg_restore --no-owner --no-privileges --dbname="$dst" "$out/auth.dump" 2> "$log" || true
  pg_restore --no-owner --no-privileges --dbname="$dst" "$out/lumen.dump" 2>> "$log" || true
  if grep -E "COPY failed|error: could not execute query: ERROR: +(relation|schema) .* does not exist" "$log" | grep -iv "function" > "$out/restore-data-errors.txt"; then
    echo "backup: data restore failed:" >&2
    grep -oE "(COPY failed for table \"[^\"]+\"|relation \"[^\"]+\"|schema \"[^\"]+\")" "$out/restore-data-errors.txt" | sort -u >&2
    status=1
  fi
  psql "$dst" -X -A -t -q -v ON_ERROR_STOP=1 -c "$(counts_sql)" > "$out/restored.txt"
  local missing=0
  while IFS='|' read -r table expected; do
    actual=$(awk -F'|' -v t="$table" '$1==t{print $2}' "$out/restored.txt")
    if [ -z "$actual" ] || [ "$actual" -lt "$expected" ]; then
      echo "backup: restored table short or missing: $table" >&2; missing=$((missing+1))
    fi
  done < "$out/manifest.txt"
  [ "$missing" -eq 0 ] || status=1
  if [ "$(psql "$dst" -X -A -t -q -c 'select count(*) from lumen.analytics_events' 2>/dev/null || echo x)" != "0" ]; then
    echo "backup: lumen.analytics_events must be restored empty" >&2; status=1
  fi
  local errors; errors=$(grep -c "error:" "$log" || true)
  echo "backup: restore check $([ $status -eq 0 ] && echo passed || echo FAILED) ($(wc -l < "$out/manifest.txt") tables, $errors non-data restore errors)"
  return $status
}

case "${1:-}" in
  dump) dump "$2" "$3" ;;
  verify) verify "$2" "$3" ;;
  *) echo "usage: $0 dump <source_url> <work_dir> | verify <work_dir> <restore_url>" >&2; exit 2 ;;
esac
