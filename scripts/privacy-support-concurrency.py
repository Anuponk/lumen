"""Disposable localhost PostgreSQL only; real concurrent support/erasure RPCs."""
import concurrent.futures
import runpy
import uuid

# Reuse the guarded connection/wait helpers and retain the original lock tests.
fixture = runpy.run_path('scripts/account-erasure-concurrency.py')
query, wait_for = fixture['query'], fixture['wait_for']

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    uid = str(uuid.uuid4())
    assert query(f"insert into auth.users(id) values ('{uid}')").returncode == 0
    assert query("update lumen_commands.support_control set enabled=true").returncode == 0
    writer = pool.submit(query,
        f"begin;set local request.jwt.claim.sub='{uid}';select public.lumen_support('{uid}','activate');"
        "select pg_sleep(3);commit;", 'fixture-support-first')
    wait_for('fixture-support-first', 'Timeout')
    erasure = pool.submit(query,
        f"select lumen_privacy.erase_account('{uid}',array[]::text[],'ERASE LUMEN {uid}')",
        'fixture-support-erasure')
    wait_for('fixture-support-erasure', 'Lock')
    assert writer.result().returncode == 0
    result = erasure.result()
    assert result.returncode == 0, result.stderr
    assert query(f"select count(*) from lumen_commands.support_cases where user_id='{uid}'").stdout.strip() == '0'

    uid = str(uuid.uuid4())
    assert query(f"insert into auth.users(id) values ('{uid}')").returncode == 0
    erasure = pool.submit(query,
        f"begin;select lumen_privacy.erase_account('{uid}',array[]::text[],'ERASE LUMEN {uid}');select pg_sleep(3);commit;",
        'fixture-support-erasure-first')
    wait_for('fixture-support-erasure-first', 'Timeout')
    writer = pool.submit(query,
        f"set request.jwt.claim.sub='{uid}';select public.lumen_support('{uid}','activate')",
        'fixture-support-after-erasure')
    wait_for('fixture-support-after-erasure', 'Lock')
    assert erasure.result().returncode == 0
    result = writer.result()
    assert result.returncode != 0 and 'LUMEN_ACCOUNT_ERASED' in result.stderr, result.stderr
    results = list(pool.map(lambda _: query(
        f"select lumen_privacy.erase_account('{uid}',array[]::text[],'ERASE LUMEN {uid}')"), range(2)))
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    assert query(f"select count(*) from auth.users where id='{uid}'").stdout.strip() == '1'

print('Concurrent support/erasure and duplicate erasures block resurrection; shared Auth survives')
