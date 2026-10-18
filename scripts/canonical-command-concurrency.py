"""Disposable localhost CI database only; no production connection parameters."""
import concurrent.futures
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']

def query(sql, allow_failure=False):
    result = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)
    if result.returncode and not allow_failure:
        raise AssertionError(result.stderr)
    return result

assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null").stdout.strip() == 't'
uid = str(uuid.uuid4())
quest = 'command-concurrent-' + uuid.uuid4().hex
query(f"insert into auth.users values ('{uid}'); insert into lumen.profile_snapshots(user_id,payload) values ('{uid}','{{\"xp\":0,\"canonicalQuestState\":{{}}}}'); insert into lumen.canonical_quest_allowlist values ('{quest}');")

def commit(operation, badges='{}', allow_failure=False):
    return query(f"begin; select set_config('request.jwt.claim.sub','{uid}',true); select public.lumen_commit_canonical_command('{operation}','{uid}','{quest}','{badges}'); select pg_sleep(0.15); commit;", allow_failure)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(lambda _: commit('same'), range(4)))
assert query(f"select count(*) from lumen_commands.canonical_receipts where user_id='{uid}'").stdout.strip() == '1'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(commit, ['next-a', 'next-b']))
assert query(f"select (select count(*) from lumen_commands.canonical_receipts where user_id='{uid}'), (select count(*) from lumen.canonical_reward_events where user_id='{uid}'), payload->>'xp' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '3|1|10'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda badges: commit('conflicting', badges, True), ['{"speed":true}', '{"noError":true}']))
assert sum(result.returncode == 0 for result in results) == 1, 'one conflicting request must be refused'
assert query(f"select count(*) from lumen_commands.canonical_receipts where user_id='{uid}'").stdout.strip() == '4'
assert query(f"select payload->>'xp' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '10'
print('Concurrent same/different/conflicting commands: one quest reward, immutable receipts, no duplicate effects')
