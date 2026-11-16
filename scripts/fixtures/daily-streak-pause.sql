-- Disposable PostgreSQL only. #752: while the Série de lumière is paused the
-- server keeps recording qualified days but never credits a streak reward, and
-- reactivation never credits days played during the pause.
do $$begin
 assert (select enabled from lumen_commands.feature_flags where name='daily_light_streak')=false,'the Série de lumière ships paused';
 assert not has_table_privilege('authenticated','lumen_commands.feature_flags','SELECT'),'players cannot read flags directly';
 assert not has_table_privilege('authenticated','lumen_commands.feature_flags','UPDATE'),'players cannot reactivate rewards';
 assert not has_function_privilege('authenticated','lumen_commands.claim_quest_daily(integer,text)','EXECUTE');
 -- The flag table holds no player data and must be classified, or account erasure refuses to run.
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='feature_flags' and action='retain-rule'),'feature_flags classified';
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
end $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000075201'),('00000000-0000-0000-0000-000000075202') on conflict do nothing;
-- Both players already played the two previous days: today is streak day 3 (+1 when enabled).
insert into lumen.daily_progress(user_id,play_date,puzzle_id)
select u::uuid,(now() at time zone 'Europe/Paris')::date-k,1
from unnest(array['00000000-0000-0000-0000-000000075201','00000000-0000-0000-0000-000000075202']) u,generate_series(1,2) k
on conflict do nothing;
insert into lumen.engagement_state(user_id,shards) values('00000000-0000-0000-0000-000000075201',3),('00000000-0000-0000-0000-000000075202',3) on conflict do nothing;

-- Paused: the day is recorded, no reward and no rewarded day.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000075201';
do $$declare r record;q integer:=(select min(legacy_index)+1 from lumen_commands.quest_rules where legacy_index is not null);begin
 select * into r from lumen_commands.claim_quest_daily(q,null);
 assert r.credited and r.reward=0 and r.streak=3,'paused claim records the day without reward: '||row(r)::text;
 assert exists(select 1 from lumen.daily_progress where user_id=auth.uid() and play_date=r.server_day),'history is kept';
 assert (select shards from lumen.engagement_state where user_id=auth.uid())=3,'no shard credited';
 assert (select rewarded_days from lumen.engagement_state where user_id=auth.uid())='{}'::jsonb,'no rewarded day';
end $$;

-- Reactivated: a newly recorded day earns the reward; a day already recorded
-- during the pause is never credited retroactively.
update lumen_commands.feature_flags set enabled=true,updated_at=now() where name='daily_light_streak';
do $$declare r record;q integer:=(select min(legacy_index)+1 from lumen_commands.quest_rules where legacy_index is not null);begin
 select * into r from lumen_commands.claim_quest_daily(q,null);
 assert not r.credited and r.reward=0,'a paused day is not rewarded after reactivation';
 assert (select shards from lumen.engagement_state where user_id=auth.uid())=3;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000075202';
do $$declare r record;q integer:=(select min(legacy_index)+1 from lumen_commands.quest_rules where legacy_index is not null);begin
 select * into r from lumen_commands.claim_quest_daily(q,null);
 assert r.credited and r.reward=1 and r.streak=3,'enabled claim keeps the historic day-3 reward: '||row(r)::text;
 assert (select shards from lumen.engagement_state where user_id=auth.uid())=4;
 assert (select rewarded_days from lumen.engagement_state where user_id=auth.uid())?(r.server_day::text);
end $$;
reset request.jwt.claim.sub;
-- Restore the shipped state for later fixtures.
update lumen_commands.feature_flags set enabled=false,updated_at=now() where name='daily_light_streak';
