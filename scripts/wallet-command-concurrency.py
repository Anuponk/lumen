"""Disposable localhost CI database only. No provider/account credentials."""
import concurrent.futures
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']

def query(sql):
    return subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)

assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null").stdout.strip() == 't'
uid = str(uuid.uuid4())
assert query(f"insert into auth.users values ('{uid}'); insert into lumen.profile_snapshots(user_id,payload) values ('{uid}','{{\"solved\":{{}},\"badges\":{{}},\"shards\":3}}');").returncode == 0

def spend(attempt):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_commit_wallet_command('{attempt}-reset-0-hint-2','{uid}','{{\"kind\":\"hint\",\"attemptId\":\"{attempt}\",\"resetCount\":0,\"sequence\":2}}');select pg_sleep(.1);commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    assert all(r.returncode == 0 for r in pool.map(spend, ['same'] * 4))
assert query(f"select payload->>'shards' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '1'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    assert all(r.returncode != 0 for r in pool.map(spend, ['insufficient-a', 'insufficient-b']))
assert query(f"select count(*) from lumen_commands.wallet_receipts where user_id='{uid}'").stdout.strip() == '1'
assert query(f"update lumen.profile_snapshots set payload=jsonb_set(payload,'{{shards}}','3') where user_id='{uid}'").returncode != 0
uid = str(uuid.uuid4())
assert query(f"insert into auth.users values ('{uid}'); insert into lumen.profile_snapshots(user_id,payload) values ('{uid}','{{\"solved\":{{}},\"badges\":{{}},\"shards\":3}}');").returncode == 0
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    competing = list(pool.map(spend, ['competing-a', 'competing-b']))
assert sum(r.returncode == 0 for r in competing) == 1
assert query(f"select payload->>'shards' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '1'
assert query(f"select count(*) from lumen_commands.wallet_receipts where user_id='{uid}'").stdout.strip() == '1'
print('Duplicate spends debit once; distinct competing spends serialize; insufficient funds and stale snapshots cannot restore spent currency')
