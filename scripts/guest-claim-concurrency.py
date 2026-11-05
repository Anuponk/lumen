"""Disposable localhost PostgreSQL only. Never production or player profiles."""
import concurrent.futures
import hashlib
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
raw = json.dumps({'solved': {'0': 1}, 'badges': {}, 'shards': 2, 'unknown': {'kept': True}}, separators=(',', ':'))
digest = hashlib.sha256(raw.encode()).hexdigest()
def claim(uid, cid):
    manifest = json.dumps(dict(version=1, userId=uid, claimId=cid, policy='new-profile-net-balance-v1', sourceDigest=digest, seedDigest=digest, sourceRaw=raw, seedRaw=raw))
    return query(f"begin;select set_config('request.jwt.claim.sub','{uid}',true);set local role authenticated;select public.lumen_claim_guest_profile('{uid}','{manifest}');select pg_sleep(.1);commit;")
uid, cid = str(uuid.uuid4()), str(uuid.uuid4())
assert query(f"insert into auth.users values ('{uid}')").returncode == 0
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(lambda _: claim(uid, cid), range(4)))
assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
assert query(f"select count(*) from lumen_commands.guest_claim_receipts where user_id='{uid}'").stdout.strip() == '1'
assert query(f"select payload->>'shards' from lumen.profile_snapshots where user_id='{uid}'").stdout.strip() == '2'
# The same provenance cannot create two account profiles, even concurrently.
owners = [str(uuid.uuid4()), str(uuid.uuid4())]
cid = str(uuid.uuid4())
assert query('insert into auth.users values '+','.join(f"('{owner}')" for owner in owners)).returncode == 0
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda owner: claim(owner, cid), owners))
assert sum(r.returncode == 0 for r in results) == 1
assert query(f"select count(*) from lumen_commands.guest_claim_receipts where claim_id='{cid}'").stdout.strip() == '1'
assert query("select count(*) from lumen.profile_snapshots where user_id in ("+','.join(f"'{owner}'" for owner in owners)+')').stdout.strip() == '1'
print('Concurrent guest retries initialize once; competing owners cannot share a claim; no second net balance')
