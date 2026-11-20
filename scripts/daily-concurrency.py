"""Disposable localhost PostgreSQL CI only. Never use against player data.
#882: concurrent devices/retries never create two official daily attempts or two results."""
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
query(f"insert into auth.users values ('{uid}');")
query(f"insert into lumen.profiles(user_id,nickname) values ('{uid}','Conc{uid[:6]}');")
query("update lumen_commands.feature_flags set enabled=true where name='daily_challenge';")
query("insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision) select lumen_commands.daily_today(),quest_id,grid_revision "
      "from lumen_commands.quest_rules order by quest_id limit 1 on conflict(day) do nothing;")

def begin(op):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_daily_begin('{op}');select pg_sleep(0.1);commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(begin, [f'dc-device-{i}' for i in range(6)]))
assert query(f"select count(*) from lumen_commands.daily_runs where user_id='{uid}'") == '1', 'one official attempt per day'
op = query(f"select operation_id from lumen_commands.daily_runs where user_id='{uid}'")
query(f"update lumen_commands.daily_runs set started_at=clock_timestamp()-interval '10 minutes' where user_id='{uid}';")

def finish(seconds):
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);select public.lumen_daily_finish(lumen_commands.daily_today(),'{op}','completed',{seconds},0,0,0);select pg_sleep(0.1);commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(finish, [100, 101, 102, 103, 104, 105]))
row = query(f"select status||':'||score from lumen_commands.daily_runs where user_id='{uid}'")
assert row.startswith('completed:') and int(row.split(':')[1]) in range(100, 106), row
assert query(f"select count(*) from lumen_commands.daily_runs where user_id='{uid}' and status='completed'") == '1'
first = row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(finish, [1, 2, 3]))
assert query(f"select status||':'||score from lumen_commands.daily_runs where user_id='{uid}'") == first, 'retries never change the official result'
query("update lumen_commands.feature_flags set enabled=false where name='daily_challenge';")
print('Daily concurrency: one attempt and one immutable result across concurrent devices/retries')
