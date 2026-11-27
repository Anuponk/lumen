"""#974 · Disposable localhost PostgreSQL only. Never run against player data.
Concurrent records on the same quest and on two quests of one constellation must
leave the materialized points equal to a from-scratch computation (no lost update,
no deadlock)."""
import concurrent.futures
import os
import subprocess
import uuid
if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']
def query(sql):
    r = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()
assert query("select current_database()='lumen_test'") == 't'
c = query("select g.constellation_id from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id) group by 1 having count(*)>=2 order by 1 limit 1")
q1, q2 = query(f"select string_agg(quest_id,',' order by quest_id) from (select g.quest_id from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id) where g.constellation_id='{c}' order by 1 limit 2) x").split(',')
players = [str(uuid.uuid4()) for _ in range(12)]
for i, p in enumerate(players):
    query(f"insert into auth.users(id) values('{p}');insert into lumen.profiles(user_id,nickname) values('{p}','Course 974 {i}');"
          f"insert into lumen_commands.ranking_members values('{p}','Course 974 {i}',true)")
def record(item):
    i, p = item
    quest = q1 if i % 2 == 0 else q2
    return query(f"begin;insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) "
                 f"select '{p}',quest_id,grid_revision,{20 + i},0 from lumen_commands.quest_rules where quest_id='{quest}';"
                 f"update lumen_commands.ranking_scores set seconds={5 + i} where user_id='{p}';select pg_sleep(0.05);commit")
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(record, enumerate(players)))
ids = ','.join(f"'{p}'" for p in players)
mismatch = query(f"""
 with visible as (select s.user_id,s.quest_id,rank() over(partition by s.quest_id order by s.score) place
   from lumen_commands.ranking_scores s join lumen_commands.quest_rules q on q.quest_id=s.quest_id and q.grid_revision=s.grid_revision
   join lumen_commands.ranking_members m on m.user_id=s.user_id join lumen.profiles p on p.user_id=s.user_id
   where s.quest_id in ('{q1}','{q2}') and m.participating and p.nickname_ready and not p.ranking_opted_out),
 expected as (select user_id,sum(lumen_commands.ranking_points(place::integer)) pts,count(*) n from visible group by user_id),
 actual as (select user_id,sum(points) pts,count(*) n from lumen_commands.ranking_quest_points where quest_id in ('{q1}','{q2}') group by user_id)
 select count(*) from (select * from expected except select * from actual union all select * from actual except select * from expected) d""")
assert mismatch == '0', 'Concurrent records keep quest points exact'
total = query(f"select count(*) from lumen_commands.ranking_constellation_totals where constellation_id='{c}' and user_id in ({ids})")
assert total == '12', 'Every concurrent player has one constellation total'
query(f"delete from auth.users where id in ({ids})")
assert query(f"select count(*) from lumen_commands.ranking_quest_points where user_id in ({ids})") == '0'
print('Concurrent #974 records keep exact, deadlock-free aggregates')
