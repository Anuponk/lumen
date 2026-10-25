"""Concurrent retention/reenabling; disposable localhost PostgreSQL only."""
import concurrent.futures
import os
import subprocess
import time
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
database = os.environ.get('LUMEN_SQL_TEST_DB', 'lumen_test')
if database not in ('lumen_test', 'lumen_privacy_test'):
    raise SystemExit('Disposable database name required')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', database,
        '-v', 'ON_ERROR_STOP=1', '-At']


def query(sql, name='fixture-retention-check'):
    return subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True,
                          timeout=25, env={**os.environ, 'PGAPPNAME': name})


def wait_for(name, wait_type):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        r = query("select exists(select 1 from pg_stat_activity where "
                  f"application_name='{name}' and wait_event_type='{wait_type}')")
        assert r.returncode == 0, r.stderr
        if r.stdout.strip() == 't':
            return
        time.sleep(.025)
    raise AssertionError(f'{name} did not reach {wait_type}')


assert query(f"select current_database()='{database}' and to_regclass('auth.sessions') is null "
             "and to_regclass('fixture_other_app.records') is not null").stdout.strip() == 't'
uid = str(uuid.uuid4())
endpoint = 'https://push.invalid/retention-concurrency-' + uid
setup = query(f"begin;insert into auth.users(id) values('{uid}');"
              "insert into public.lumen_push_subscriptions(user_id,endpoint,enabled) "
              f"values('{uid}','{endpoint}',false);"
              # Synthetic age only; existing erasure guard stays enabled.
              "alter table public.lumen_push_subscriptions disable trigger lumen_retention_stamp;"
              "update public.lumen_push_subscriptions set privacy_disabled_at=now()-interval '91 days' "
              f"where endpoint='{endpoint}';"
              "alter table public.lumen_push_subscriptions enable trigger lumen_retention_stamp;commit;")
assert setup.returncode == 0, setup.stderr
purge_sql = "select lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA')"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    writer = pool.submit(query,
                        f"begin;update public.lumen_push_subscriptions set enabled=true where endpoint='{endpoint}';"
                        "select pg_sleep(5);commit;", 'fixture-retention-reenable')
    wait_for('fixture-retention-reenable', 'Timeout')
    purge = pool.submit(query, purge_sql)
    result = purge.result(timeout=4)
    assert result.returncode == 0, result.stderr
    assert writer.result().returncode == 0
    assert query("select enabled and privacy_disabled_at is null from public.lumen_push_subscriptions "
                 f"where endpoint='{endpoint}'").stdout.strip() == 't'

    # Retention holds a table lock against concurrent DDL/guard replacement.
    holder = pool.submit(query, 'begin;' + purge_sql + ';select pg_sleep(3);commit;',
                         'fixture-retention-ddl-holder')
    wait_for('fixture-retention-ddl-holder', 'Timeout')
    ddl = pool.submit(query, "begin;alter table public.lumen_push_subscriptions disable trigger "
                      "lumen_retention_stamp;rollback;", 'fixture-retention-ddl-waiter')
    wait_for('fixture-retention-ddl-waiter', 'Lock')
    assert holder.result().returncode == 0
    assert ddl.result().returncode == 0

assert query(f"delete from public.lumen_push_subscriptions where endpoint='{endpoint}';"
             f"delete from auth.users where id='{uid}'").returncode == 0
print('Retention skips concurrent reenabling, preserves active subscriptions and serializes guard DDL')
