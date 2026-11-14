"""Disposable localhost PostgreSQL CI only. Never use against player data."""
import concurrent.futures
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']

def query(sql):
    r = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()

assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null") == 't'
uid = str(uuid.uuid4())
q = query('select quest_id from lumen_commands.quest_rules where grid_revision=0 order by quest_id limit 1')
started = query('select clock_timestamp()')
query(f"insert into auth.users values ('{uid}');")

def begin(op):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_ranking_begin('{op}','{q}',0,'{started}');select pg_sleep(0.1);commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(lambda _: begin('ranking-same'), range(4)))
assert query(f"select count(*) from lumen_commands.ranking_runs where user_id='{uid}'") == '1'
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(begin, ['ranking-b', 'ranking-c', 'ranking-d', 'ranking-e']))
assert query(f"select count(*) from lumen_commands.ranking_runs where user_id='{uid}' and eligible") == '1', 'Concurrent devices cannot bypass the fifteen-minute reservation'
query(f"insert into lumen.profile_snapshots(user_id,payload) values ('{uid}','{{\"solved\":{{}},\"badges\":{{}},\"stars\":{{}},\"performances\":{{}},\"challenges\":{{}},\"canonicalQuestState\":{{}},\"xp\":0,\"shards\":7}}');")
query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_commit_wallet_command('wallet-establish-v1','{uid}','{{\"kind\":\"establish\"}}');select public.lumen_ranking_membership(true,'Concurrent');select public.lumen_commit_quest_command('ranking-same','{uid}','{q}',jsonb_build_object('seconds',0,'assistanceUsed',false,'hintUsed',false,'mistakeCommitted',false,'qualifying',true,'challengeFailed',false,'qualifiedDay',current_date::text,'qualifiedAt','{started}'));commit;")

def finish(_):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_ranking_finish('ranking-same',0,0);select pg_sleep(0.1);commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(finish, range(4)))
assert query(f"select count(*) from lumen_commands.ranking_scores where user_id='{uid}'") == '1'
print('Ranking concurrency: one reservation, immutable launch, one score across concurrent devices/retries')
