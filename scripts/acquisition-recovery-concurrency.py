"""Real PostgreSQL concurrency; disposable localhost fixture only."""
import concurrent.futures
import json
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']


def query(sql):
    result = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null") == 't'
uid = str(uuid.uuid4())
idx = query('select legacy_index from lumen_commands.quest_rules where legacy_index is not null order by legacy_index limit 1')
local = json.dumps(dict(solved={idx: 1}, badges=dict(concurrent=1), shards=500))
profile = json.dumps(dict(solved={}, badges={}, shards=10, xp=0))
query(f"insert into auth.users values ('{uid}');insert into lumen.profile_snapshots values ('{uid}','{profile}',now())")
prefix = f"begin;select set_config('request.jwt.claim.sub','{uid}',true);"


def recover():
    # Real callers retry a null CAS result using a fresh account-scoped read.
    for _ in range(2):
        expected = query(f"select payload from lumen.profile_snapshots where user_id='{uid}'")
        result = query(prefix + f"select public.lumen_reconcile_acquisitions('{uid}','{expected}','{local}');commit;")
        if 'positive-acquisitions-v1' in result:
            return True
    return False  # bounded deferral while other mutations are still in flight


def spend():
    request = json.dumps(dict(kind='hint', attemptId='parallel-spend', resetCount=0, sequence=1))
    query(prefix + f"select public.lumen_commit_wallet_command('parallel-spend-reset-0-hint-1','{uid}','{request}');select pg_sleep(.1);commit;")


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    jobs = [pool.submit(recover), pool.submit(recover), pool.submit(spend), pool.submit(spend)]
    for job in jobs:
        job.result()
assert recover()  # settled retry / lost response / new device
assert query(f"select payload->>'shards',payload->'solved'->>'{idx}',payload->'badges'->>'concurrent' from lumen.profile_snapshots where user_id='{uid}'") == '9|1|1'
assert query(f"select count(*) from lumen_commands.wallet_receipts where user_id='{uid}'") == '1'
assert query(f"select count(*) from lumen_commands.acquisition_recovery_sources where user_id='{uid}' and source='{local}'::jsonb") == '1'
assert query(f"select count(*) from lumen_commands.legacy_receipts where user_id='{uid}'") == '0'
print('Concurrent recovery/spend, duplicate recovery, response-loss retry: acquisitions kept, one debit, no reward receipt minted')
