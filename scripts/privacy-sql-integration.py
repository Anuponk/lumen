#!/usr/bin/env python3
"""Run the actual scope_predicate function against disposable PostgreSQL 17."""
from pathlib import Path
import os
import subprocess

source = Path("supabase/migrations/20261022160212_lumen_account_erasure.sql").read_text()
start = source.index("create function lumen_privacy.scope_predicate(")
end = source.index("create function lumen_privacy.guard_write()", start)
function_sql = source[start:end]
setup = """
create schema lumen_privacy;
create schema lumen_commands;
create table lumen_commands.support_cases (id uuid primary key, user_id uuid);
create table lumen_commands.support_access (
 id uuid primary key, actor text, privacy_owner_id uuid, case_id uuid
);
"""
tests = """
insert into lumen_commands.support_cases values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into lumen_commands.support_access values
 ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,null),
 ('44444444-4444-4444-4444-444444444444','operator',null,'11111111-1111-1111-1111-111111111111'),
 ('55555555-5555-5555-5555-555555555555','other',null,'22222222-2222-2222-2222-222222222222');
do $$
declare predicate text; found_ids uuid[]; owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
 predicate := lumen_privacy.scope_predicate('lumen_commands','support_access',null,null,null);
 execute format('select array_agg(id order by id) from lumen_commands.support_access where %s', predicate)
 into found_ids using owner, array[]::text[], array[]::text[];
 if cardinality(found_ids) <> 2 or
   not ('33333333-3333-3333-3333-333333333333'::uuid = any(found_ids)) or
   not ('44444444-4444-4444-4444-444444444444'::uuid = any(found_ids)) then
   raise exception 'Incorrect erasure scope: %', found_ids;
 end if;
 raise notice 'PASS: correct actor and support-case erasure scope; other player retained';
end $$;
"""
sql = "begin;\n" + setup + function_sql + tests + "rollback;\n"
result = subprocess.run(
    ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-q"],
    input=sql, text=True, capture_output=True, env=os.environ
)
print(result.stdout)
print(result.stderr)
if result.returncode:
    raise SystemExit(result.returncode)
print("PASS: real PostgreSQL integration, rolled back")
