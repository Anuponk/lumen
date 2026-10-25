"""Real PostgreSQL concurrency; disposable localhost fixtures only."""
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
uid, capture = str(uuid.uuid4()), str(uuid.uuid4())
assert query(f"insert into auth.users(id) values('{uid}'); update lumen_commands.support_control set enabled=true").returncode == 0

def action(name, case=None, cid=None):
    data = json.dumps(dict(format=1, events=[], code='manual', version='unknown', copies=[dict(source='local', facts=[])]))
    ref = f"'{case}'" if case else 'null'
    cap = f"'{cid}'" if cid else 'null'
    return query(f"set request.jwt.claim.sub='{uid}';set role authenticated;select public.lumen_support('{uid}','{name}',{ref},{cap},'{data}'::jsonb);")

case = json.loads(action('activate').stdout.strip().splitlines()[-1])['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(lambda _: action('capture', case, capture), range(6)))
assert all(r.returncode == 0 for r in results), 'concurrent retry rejected'
assert query(f"select count(*) from lumen_commands.support_captures where case_id='{case}'").stdout.strip() == '1'
assert query(f"update lumen_commands.support_captures set received_at=now()-interval '2 minutes' where case_id='{case}'").returncode == 0
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    work = [pool.submit(action, 'capture', case, str(uuid.uuid4())) for _ in range(5)]
    work.append(pool.submit(action, 'revoke'))
    results = [w.result() for w in work]
assert results[-1].returncode == 0, 'revocation failed'
assert query(f"select count(*) from lumen_commands.support_captures where case_id='{case}'").stdout.strip() == '0', 'revocation raced ingestion'
assert action('capture', case, capture).returncode != 0, 'revoked identity replayed'

# Purge wins over a queued upload after its support-only owner lock.
case = json.loads(action('activate').stdout.strip().splitlines()[-1])['id']
assert query(f"update lumen_commands.support_cases set activated_at=now()-interval '8 days', expires_at=now()-interval '7 days' where id='{case}'").returncode == 0
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    upload = pool.submit(action, 'capture', case, str(uuid.uuid4()))
    purge = pool.submit(query, 'select lumen_commands.prune_support();')
    assert upload.result().returncode != 0
    assert purge.result().returncode == 0
assert query(f"select count(*) from lumen_commands.support_contents s join lumen_commands.support_captures c on c.id=s.capture_id where c.case_id='{case}'").stdout.strip() == '0'
print('Support concurrent retry, revocation and expired purge passed; no player saves touched')
