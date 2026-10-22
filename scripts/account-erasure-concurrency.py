"""Real PostgreSQL concurrency; deliberately restricted to disposable localhost CI."""
import concurrent.futures
import os
import subprocess
import time
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test',
        '-v', 'ON_ERROR_STOP=1', '-At']


def query(sql, name='fixture-erasure-check'):
    return subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True,
                          timeout=25, env={**os.environ, 'PGAPPNAME': name})


def wait_for(name, wait_type):
    # Names and wait types are fixed test constants, never account/user input.
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        r = query(f"select exists(select 1 from pg_stat_activity where "
                  f"application_name='{name}' and wait_event_type='{wait_type}')")
        assert r.returncode == 0, r.stderr
        if r.stdout.strip() == 't':
            return
        time.sleep(.025)
    raise AssertionError(f'{name} did not reach {wait_type}')


assert query("select current_database()='lumen_test' and to_regclass('auth.sessions') is null "
             "and to_regclass('fixture_other_app.records') is not null").stdout.strip() == 't'

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    # Erasure commits while an old writer waits behind its locks. In particular,
    # the writer's outer statement began before the fingerprint was committed.
    uid = str(uuid.uuid4())
    assert query(f"insert into auth.users values ('{uid}')").returncode == 0
    erasure = pool.submit(query,
        f"begin;select lumen_privacy.erase_account('{uid}',array[]::text[],'ERASE LUMEN {uid}');"
        "select pg_sleep(3);commit;", 'fixture-erasure-first')
    wait_for('fixture-erasure-first', 'Timeout')
    writer = pool.submit(query,
        f"insert into lumen.profiles(user_id,nickname) values('{uid}','Stale client')",
        'fixture-erasure-old-writer')
    wait_for('fixture-erasure-old-writer', 'Lock')
    assert erasure.result().returncode == 0
    result = writer.result()
    assert result.returncode != 0 and 'LUMEN_ACCOUNT_ERASED' in result.stderr, result.stderr
    assert query(f"select count(*) from lumen.profiles where user_id='{uid}'").stdout.strip() == '0'

    # A write already in flight commits first; review under locks discovers and
    # erases it rather than purging an older snapshot of the player's tables.
    uid = str(uuid.uuid4())
    assert query(f"insert into auth.users values ('{uid}')").returncode == 0
    writer = pool.submit(query,
        f"begin;insert into lumen.profiles values('{uid}','In flight');select pg_sleep(3);commit;",
        'fixture-erasure-writer-first')
    wait_for('fixture-erasure-writer-first', 'Timeout')
    erasure = pool.submit(query,
        f"select lumen_privacy.erase_account('{uid}',array[]::text[],'ERASE LUMEN {uid}')",
        'fixture-erasure-after-writer')
    wait_for('fixture-erasure-after-writer', 'Lock')
    assert writer.result().returncode == 0
    result = erasure.result()
    assert result.returncode == 0, result.stderr
    assert query(f"select count(*) from lumen.profiles where user_id='{uid}'").stdout.strip() == '0'
    assert query(f"select count(*) from auth.users where id='{uid}'").stdout.strip() == '1'

print('Concurrent erasure blocks stale writers and includes in-flight committed data; shared Auth survives')
