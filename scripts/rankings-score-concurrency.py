"""#974: disposable localhost PostgreSQL; concurrent records, badges and N changes."""
import concurrent.futures
import os
import subprocess
import uuid

if os.environ.get('LUMEN_SQL_FIXTURE') != '1':
    raise SystemExit('Requires explicit disposable SQL fixture mode')
PSQL = ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'lumen_test', '-v', 'ON_ERROR_STOP=1', '-At']

def query(sql):
    result = subprocess.run(PSQL + ['-c', sql], capture_output=True, text=True, timeout=90)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

assert query("select current_database()='lumen_test'") == 't'
adventure = query("select g.adventure_id from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id) where q.legacy_index is null group by 1 having count(*)>=2 order by 1 limit 1")
quests = query(f"select string_agg(quest_id,',' order by quest_id) from (select g.quest_id from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id) where g.adventure_id='{adventure}' and q.legacy_index is null order by 1 limit 2) q").split(',')
players = [str(uuid.uuid4()) for _ in range(12)]
for i, player in enumerate(players):
    query(f"insert into auth.users(id) values('{player}');insert into lumen.profiles(user_id,nickname) values('{player}','Concurrent974_{i}');insert into lumen_commands.ranking_members values('{player}','Concurrent974_{i}',true)")
    for quest in quests:
        query(f"insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) values('{player}','{quest}','{{\"badges\":{{}}}}');insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) select '{player}',quest_id,grid_revision,{100+i},0 from lumen_commands.quest_rules where quest_id='{quest}'")

def change(item):
    kind, i = item
    player, quest = players[i // 2], quests[i % 2]
    if kind == 'record':
        sql = f"update lumen_commands.ranking_scores set seconds={10+i} where user_id='{player}' and quest_id='{quest}'"
    else:
        sql = f"update lumen_commands.quest_run_authority set projection='{{\"badges\":{{\"autonomy\":true,\"noError\":true}}}}' where user_id='{player}' and quest_id='{quest}'"
    return query(f"begin;{sql};select pg_sleep(0.02);commit")

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    list(pool.map(change, [(kind, i) for i in range(12) for kind in ['record', 'badge']]))

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(lambda player: query(f"update lumen.profiles set ranking_opted_out=true where user_id='{player}'"), players[8:10]))

quoted = ','.join(f"'{player}'" for player in players)
quest_list = ','.join(f"'{quest}'" for quest in quests)
expected = f"""
with visible as (
 select s.user_id,s.quest_id,rank() over(partition by s.quest_id order by s.score)::integer place,
 count(*) over(partition by s.quest_id)::integer n,a.projection->'badges' badges
 from lumen_commands.ranking_scores s join lumen_commands.quest_rules q on q.quest_id=s.quest_id and q.grid_revision=s.grid_revision
 join lumen_commands.ranking_members m on m.user_id=s.user_id join lumen.profiles p on p.user_id=s.user_id
 left join lumen_commands.quest_run_authority a on a.user_id=s.user_id and a.quest_id=s.quest_id
 where s.quest_id in ({quest_list}) and m.participating and p.nickname_ready and not p.ranking_opted_out),
 expected as (select user_id,quest_id,place,20+case when n=1 then 50 else round(50::numeric*(n-place)/(n-1))::integer end
  +case when badges->>'autonomy' in ('true','1') then 15 else 0 end+case when badges->>'noError' in ('true','1') then 15 else 0 end points from visible),
 actual as (select user_id,quest_id,place,points from lumen_commands.ranking_quest_points where quest_id in ({quest_list}))
"""
assert query(expected + "select count(*) from ((select * from expected except select * from actual) union all (select * from actual except select * from expected)) d") == '0'
assert query(expected + f"""
select count(*) from lumen_commands.ranking_adventure_totals t cross join lateral (
 select sum(points)::integer points,count(*)::integer quests from expected e where e.user_id=t.user_id) x
 where t.adventure_id='{adventure}' and t.user_id in ({quoted}) and (t.points,t.quests) is distinct from (x.points,x.quests)
""") == '0', 'Different quests of the same adventure cannot lose each other’s totals'
query(f"delete from auth.users where id in ({quoted})")
assert query(f"select count(*) from lumen_commands.ranking_quest_points where user_id in ({quoted})") == '0'
print('Concurrent #974 score, durable badge and visibility changes keep exact quest/adventure totals')
