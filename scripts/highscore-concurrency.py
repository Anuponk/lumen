"""Disposable localhost PostgreSQL only. Never run against player data."""
import concurrent.futures
import os
import subprocess
import uuid
if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']
def query(sql, allow_error=False):
    r = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)
    if not allow_error:
        assert r.returncode == 0, r.stderr
    return r
assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null").stdout.strip() == 't'
a, b = str(uuid.uuid4()), str(uuid.uuid4())
query(f"insert into auth.users values('{a}'),('{b}')")
def claim(item):
    uid, name = item
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_set_nickname('{name}');select pg_sleep(0.1);commit", True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(claim, [(a, 'Race star'), (b, ' RACE STAR ')]))
assert sum(r.returncode == 0 for r in results) == 1, 'Exactly one concurrent nickname claim succeeds'
assert query("select count(*) from lumen.profiles where lower(btrim(nickname))='race star'").stdout.strip() == '1'
uid = a if results[0].returncode == 0 else b
query("update lumen_commands.ranking_control set automatic_after=clock_timestamp()-interval '1 minute',historical_enabled=true")
def action(kind):
    expr = "public.lumen_ranking_membership(false,null)" if kind == 'withdraw' else "lumen_commands.ranking_auto(clock_timestamp())" if kind == 'auto' else "lumen_commands.import_ranking_history(true)"
    # Imports are operator-only; do not impersonate a player for that operation.
    setting = '' if kind == 'import' else f"select set_config('request.jwt.claim.sub','{uid}',true);"
    return query(f"begin;{setting}select {expr};select pg_sleep(0.1);commit")
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(action, ['withdraw', 'auto', 'import']))
query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select lumen_commands.ranking_auto(clock_timestamp());commit")
assert query(f"select ranking_opted_out from lumen.profiles where user_id='{uid}'").stdout.strip() == 't'
assert query(f"select count(*) from lumen_commands.ranking_members where user_id='{uid}'").stdout.strip() == '0', 'Auto never revokes withdrawal'
print('Highscore concurrency: case-folded nickname claim, automatic enrollment, withdrawal and import serialized')
