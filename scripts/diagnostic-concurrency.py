"""Disposable localhost CI only. No profile or save is read or modified."""
import concurrent.futures
import json
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
assert query(f"insert into auth.users(id) values ('{uid}');set request.jwt.claim.sub='{uid}';select public.lumen_diagnostic_preference(true);").returncode == 0
assert query("update lumen_commands.diagnostic_budgets set events=0,calls=0,minute_calls=0 where lane='details' and subject='global'").returncode == 0
at = query("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')").stdout.strip()
event = dict(id=str(uuid.uuid4()), session=str(uuid.uuid4()), trace=str(uuid.uuid4()), seq=1, at=at,
             code='runtime_exception', stage='runtime', kind='unknown', platform='desktop', browser='chromium',
             version='1.11.1+501', before='unknown', after='unknown', retry=0)

def send(packet):
    encoded = json.dumps([packet])
    return query(f"set request.jwt.claim.sub='{uid}';set role authenticated;select public.lumen_record_diagnostics('{uid}','{encoded}'::jsonb);")

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    replies = list(pool.map(send, [event] * 6))
assert all(r.returncode == 0 and event['id'] in r.stdout for r in replies), 'concurrent retry failed'
assert query(f"select count(*) from lumen_commands.diagnostic_events where user_id='{uid}'").stdout.strip() == '1'
assert query(f"update lumen_commands.diagnostic_budgets set events=198,minute_calls=0 where lane='details' and subject='{uid}'").returncode == 0
packets = [{**event, 'id': str(uuid.uuid4()), 'seq': i + 2} for i in range(6)]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    replies = list(pool.map(send, packets))
assert all(r.returncode == 0 for r in replies)
assert query(f"select count(*) from lumen_commands.diagnostic_events where user_id='{uid}'").stdout.strip() == '3', 'daily quota raced'
assert query(f"select events from lumen_commands.diagnostic_budgets where lane='details' and subject='{uid}'").stdout.strip() == '200'
assert query(f"update lumen_commands.diagnostic_budgets set events=0,minute_calls=0 where lane='details' and subject='{uid}'").returncode == 0
def withdraw(_):
    return query(f"set request.jwt.claim.sub='{uid}';set role authenticated;select public.lumen_diagnostic_preference(false);")
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    work = [pool.submit(send, {**event, 'id': str(uuid.uuid4()), 'seq': 20 + i}) for i in range(5)]
    work.append(pool.submit(withdraw, None))
    assert all(task.result().returncode == 0 for task in work)
assert query(f"select enabled from lumen_commands.diagnostic_preferences where user_id='{uid}'").stdout.strip() == 'f'
assert query(f"select count(*) from lumen_commands.diagnostic_events where user_id='{uid}'").stdout.strip() == '0', 'withdrawal raced ingestion'
print('Diagnostic concurrent retry identity and daily quota passed; no profiles touched')
