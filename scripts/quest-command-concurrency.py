"""Disposable localhost PostgreSQL only; never provider credentials/player data."""
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
quests = query("select quest_id from lumen_commands.quest_rules where legacy_index is null order by (rules->>'ordinal')::integer limit 2").stdout.strip().splitlines()
facts = dict(seconds=45, assistanceUsed=False, mistakeCommitted=False, qualifying=True, hintUsed=False,
             challengeFailed=False, qualifiedDay='2026-10-22', qualifiedAt='2026-10-22T10:00:00.000Z')
profile = dict(solved={}, badges={}, shards=7, xp=0, autonomousWins=2, canonicalQuestState={})
query(f"insert into auth.users values ('{uid}');insert into lumen.profile_snapshots values ('{uid}','{json.dumps(profile)}',now());")


def commit(operation, quest=quests[0], evidence=facts, failure=False):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_commit_quest_command('{operation}','{uid}','{quest}','{json.dumps(evidence)}');select pg_sleep(.1);commit;", failure)


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(lambda _: commit('same'), range(4)))
assert query(f"select count(*) from lumen_commands.canonical_receipts where user_id='{uid}'").stdout.strip() == '1'
assert query(f"select payload->>'xp',payload->>'shards',payload->>'autonomousWins' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '15|8|3'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda seconds: commit('conflicting', evidence={**facts, 'seconds': seconds}, failure=True), [40, 41]))
assert sum(result.returncode == 0 for result in results) == 1
assert query(f"select count(*) from lumen.canonical_reward_events where user_id='{uid}'").stdout.strip() == '1'


def spend():
    request = dict(kind='hint', attemptId='isolated-spend', resetCount=0, sequence=2)
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_commit_wallet_command('isolated-spend-reset-0-hint-2','{uid}','{json.dumps(request)}');select pg_sleep(.1);commit;")


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = [pool.submit(commit, 'another-quest', quests[1]), pool.submit(commit, 'historical-quest', 'base-q071'), pool.submit(spend)]
    for future in futures:
        future.result()
assert query(f"select payload->>'xp',payload->>'shards',payload->>'autonomousWins' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '45|6|5'
assert query(f"select count(*) from lumen.daily_progress where user_id='{uid}'").stdout.strip() == '1'
print('Quest duplicates/conflicting evidence and mixed historical/canonical victory/spend serialize without duplicate rewards or currency restoration')
