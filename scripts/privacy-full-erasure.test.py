#!/usr/bin/env python3
"""Disposable PostgreSQL integration of the COMPLETE Lumen erasure migration."""
from pathlib import Path
import os
import subprocess

migration = Path("supabase/migrations/20261022160212_lumen_account_erasure.sql").read_text()
bootstrap = """
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $uid$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$uid$;
create table auth.users (id uuid primary key);
insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
create schema soldezen;
create table soldezen.accounts (user_id uuid primary key, balance int);
insert into soldezen.accounts values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',42),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',17);
create schema lumen;
create schema lumen_commands;
"""
# The fixture catalog is derived from the real policy function, not a
# hand-maintained list that could silently omit a new erasure target.
policy_start = migration.index("create function lumen_privacy.policy()")
policy_end = migration.index("create function lumen_privacy.scope_predicate(",policy_start)
policy = migration[policy_start:policy_end]
bootstrap += "create schema lumen_privacy;\n" + policy + """
do $fixture$
declare r record; cols text; typ text;
begin
 for r in select * from lumen_privacy.policy() loop
  if r.action='derived-view' then
   execute format('create view %I.%I as select 1::integer as dummy',r.ns,r.rel);
   continue;
  end if;
  cols := 'id uuid';
  if r.uid_col is not null then
   cols:=cols||format(', %I uuid',r.uid_col);
  end if;
  if r.actor_col is not null then
   cols:=cols||format(', %I text',r.actor_col);
  end if;
  if r.key_col is not null then
   cols:=cols||format(', %I text',r.key_col);
  end if;
  if r.ns='lumen' and r.rel='social_challenges' then
   cols:=cols||', sender_display_name text';
  end if;
  if r.ns='lumen_commands' and r.rel='diagnostic_budgets' then
   cols:=cols||', subject text';
  end if;
  if r.ns='lumen_commands' and r.rel in ('support_captures','support_access') then
   cols:=cols||', case_id uuid';
  end if;
  if r.ns='lumen_commands' and r.rel='support_contents' then
   cols:=cols||', capture_id uuid';
  end if;
  if r.ns='lumen_commands' and r.rel='support_access' then
   cols:=cols||', privacy_owner_id uuid';
  end if;
  execute format('create table %I.%I (%s)',r.ns,r.rel,cols);
 end loop;
end $fixture$;
drop schema lumen_privacy cascade;
"""
tests = """
insert into lumen.profiles(id,user_id) values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $check$
declare result jsonb;
begin
 begin
  perform lumen_privacy.erase_account(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',array[]::text[],'WRONG');
  raise exception 'Erasure accepted missing confirmation';
 exception when sqlstate '22023' then null;
 end;
 result:=lumen_privacy.erase_account(
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',array[]::text[],
   'ERASE LUMEN aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if result->>'status'<>'erased' then raise exception 'Erasure failed: %',result;end if;
 if (select count(*) from lumen.profiles)<>1 or
    (select user_id from lumen.profiles limit 1)<>'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' then
    raise exception 'Wrong player deleted or target retained';end if;
 if (select count(*) from auth.users)<>2 or
    (select sum(balance) from soldezen.accounts)<>59 then
    raise exception 'Shared authentication or SoldeZen modified';end if;
 begin
  insert into lumen.profiles(id,user_id) values
   ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  raise exception 'Erased player resurrected';
 exception when sqlstate '42501' then null;
 end;
 raise notice 'PASS: full erasure, isolation, confirmation and resurrection barrier';
end $check$;
rollback;
"""
# Recreate real policy with its original schema to avoid duplicate schema creation.
bootstrap = bootstrap.replace("create schema lumen_privacy;\n","create schema lumen_privacy;\n")
sql = bootstrap + migration + tests
result = subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1","-q"],
                        input=sql,text=True,capture_output=True,env=os.environ)
print(result.stdout)
print(result.stderr)
raise SystemExit(result.returncode)
