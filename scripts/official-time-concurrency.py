"""Disposable localhost PostgreSQL only. Never execute against player data."""
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
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null") == 't'
for legacy in [True, False]:
    owner = str(uuid.uuid4())
    quest = query(f"select quest_id from lumen_commands.quest_rules where grid_revision=0 and (legacy_index is not null)={'true' if legacy else 'false'} order by quest_id limit 1")
    query(f"insert into auth.users values('{owner}'); insert into lumen.profile_snapshots(user_id,payload) values('{owner}', '{{\"solved\":{{}},\"badges\":{{}},\"stars\":{{}},\"performances\":{{}},\"canonicalQuestState\":{{}},\"challenges\":{{}},\"xp\":0,\"shards\":7}}');")
    query(f"begin;select set_config('request.jwt.claim.sub','{owner}',true);select public.lumen_commit_wallet_command('wallet-establish-v1','{owner}','{{\"kind\":\"establish\"}}');commit")

    def finish(item):
        operation, hints = item
        facts = {'seconds':60, 'assistanceUsed':True, 'hintUsed':True, 'mistakeCommitted':False, 'qualifying':False, 'challengeFailed':True, 'qualifiedDay':'2026-11-11', 'qualifiedAt':'2026-11-11T10:00:00Z', 'timing':{'version':1, 'gridRevision':0, 'helpUses':{'hint':hints, 'verify':0, 'guided':0}}}
        return query(f"begin;select set_config('request.jwt.claim.sub','{owner}',true);select public.lumen_commit_quest_command('{operation}','{owner}','{quest}','{json.dumps(facts)}');select pg_sleep(0.05);commit")

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(finish, [('official-duplicate', 5)] * 4))
    table = 'legacy_receipts' if legacy else 'canonical_receipts'
    assert query(f"select count(*) from lumen_commands.{table} where user_id='{owner}'") == '1', 'Concurrent duplicate cannot multiply rewards or penalties'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(finish, [(f'official-device-{i}', i+1) for i in range(4)]))
    performance = "payload->'performances'->(select legacy_index::text from lumen_commands.quest_rules where quest_id='"+quest+"')" if legacy else "payload#>'{canonicalQuestState,"+quest+",runPerformance}'"
    assert query(f"select ({performance})->'officialTimes'->>'0' from lumen.profile_snapshots where user_id='{owner}'") == '75', 'Independent device commits preserve the smallest official total'
    assert query(f"select ({performance})->>'attempts' from lumen.profile_snapshots where user_id='{owner}'") == '5'
print('Official time concurrency: both quest generations, duplicate evidence, one reward and minimum across four devices')
