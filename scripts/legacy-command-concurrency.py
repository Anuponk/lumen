"""Explicit disposable localhost PostgreSQL only; no production parameters."""
import concurrent.futures
import json
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']

def query(sql, failure=False):
    result = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)
    if result.returncode and not failure:
        raise AssertionError(result.stderr)
    return result

assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null").stdout.strip() == 't'
uid = str(uuid.uuid4())
quest = query('select quest_id from lumen_commands.legacy_rules where legacy_index=5').stdout.strip()
facts = dict(seconds=45, assistanceUsed=False, mistakeCommitted=False, qualifying=True, hintUsed=False,
             challengeFailed=False, qualifiedDay='2026-10-18', qualifiedAt='2026-10-18T10:00:00.000Z')
profile = dict(solved={}, badges={}, stars={}, challenges={}, noHint={}, performances={}, xp=0, shards=3,
               skyScore=0, skyHistoryVersion=4)
query(f"insert into auth.users values ('{uid}'); insert into lumen.profile_snapshots(user_id,payload) values ('{uid}','{json.dumps(profile)}');")

def commit(operation, run=None, failure=False):
    evidence = json.dumps(run or facts)
    return query(f"begin; select set_config('request.jwt.claim.sub','{uid}',true); select public.lumen_commit_legacy_command('{operation}','{uid}','{quest}','{evidence}'); select pg_sleep(0.1); commit;", failure)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(lambda _: commit('same-reset-0'), range(4)))
assert query(f"select count(*) from lumen_commands.legacy_receipts where user_id='{uid}'").stdout.strip() == '1'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(commit, ['different-a-reset-0', 'different-b-reset-0']))
result = query(f"select payload->>'xp', payload->>'shards', payload->'performances'->'5'->>'attempts' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip()
assert result == '40|4|3', result  # one first win + one challenge, three actual operations
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda seconds: commit('conflicting-reset-0', {**facts, 'seconds': seconds}, True), [44, 43]))
assert sum(r.returncode == 0 for r in results) == 1
assert query(f"select count(*) from lumen_commands.legacy_receipts where user_id='{uid}'").stdout.strip() == '4'
# A stale unconditional backup racing a new operation must never remove rewards.
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    command = pool.submit(commit, 'next-reset-0')
    stale = pool.submit(query, f"begin; select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_backup_profile('{json.dumps(profile)}');commit;", True)
    command.result()
    assert stale.result().returncode != 0
assert query(f"select payload->>'xp',payload->'performances'->'5'->>'attempts' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '40|5'
print('Historical concurrent duplicates, separate runs, conflicting evidence and stale backup: no double reward or lost projection')
