-- #708 Lot C: Acquisition & engagement aggregates for Analytics. Read-only,
-- administrators only (analytics_cockpit), aggregates only: no identifier,
-- nickname, email or URL leaves the database. Reuses existing sources:
-- lumen.analytics_events (consented/QA sessions only while public collection
-- is disabled), #18/#35 challenge tables and the #882 daily runs.
begin;

create or replace function public.lumen_admin_engagement(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 d integer:=least(greatest(coalesce(p_days,7),1),3650);
 since timestamptz:=statement_timestamp()-make_interval(days=>least(greatest(coalesce(p_days,7),1),3650));
 traffic jsonb;acquisition jsonb;challenges jsonb;daily jsonb;flag boolean;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid()
  and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;

 -- Identifiers by traffic class, priority automated_test > qa > human > undetermined
 -- (#708, 18/11): an identifier seen as QA once is never counted as a player.
 with ids as (
  select e.anonymous_id,
   bool_or(e.properties->>'traffic_type'='automated_test') as automated,
   bool_or(e.properties->>'traffic_type'='qa' or coalesce(e.properties->>'qa_mode','')<>'') as qa,
   bool_or(e.properties->>'traffic_type'='human') as human
  from lumen.analytics_events e
  where e.occurred_at>=since and e.anonymous_id is not null
  group by e.anonymous_id)
 select jsonb_build_object('identifiers',count(*),
  'automated_test',count(*) filter(where automated),
  'qa',count(*) filter(where qa and not automated),
  'human',count(*) filter(where human and not automated and not qa),
  'undetermined',count(*) filter(where not automated and not qa and not human))
 into traffic from ids;

 -- Acquisition funnel by channel: same contract as docs/marketing/acquisition-agregats.sql
 -- (human, non-QA identifiers; game opening, then quest 1 in the same session within 30 min).
 with events as (
  select e.anonymous_id,e.session_id,e.event_name,e.occurred_at,e.properties->>'acquisition_channel' as channel
  from lumen.analytics_events e
  where e.event_name in ('app_opened','attempt_started','attempt_completed')
   and e.occurred_at>=since
   and e.properties->>'acquisition_channel' in ('player_share','player_invite','challenge_link','youtube_shorts','instagram_reels','tiktok')
   and e.properties->>'traffic_type'='human' and coalesce(e.properties->>'qa_mode','')=''
   and not exists(select 1 from lumen.analytics_events x where x.anonymous_id=e.anonymous_id and x.occurred_at>=since
    and (x.properties->>'traffic_type' in ('qa','automated_test') or coalesce(x.properties->>'qa_mode','')<>''))
   and (e.event_name='app_opened' or (e.properties->>'quest_ordinal'='1' and e.properties->>'attempt_mode'='campaign'
    and (e.event_name='attempt_started' or (e.properties->>'outcome'='success' and e.properties->>'first_completion'='true'))))
 ), opens as (
  select anonymous_id,session_id,channel,min(occurred_at) as opened_at from events where event_name='app_opened'
  group by anonymous_id,session_id,channel
 ), funnel as (
  select o.channel,
   min(e.occurred_at) filter(where e.event_name='attempt_started') as started_at,
   max(e.occurred_at) filter(where e.event_name='attempt_completed') as completed_at
  from opens o left join events e on (e.anonymous_id,e.session_id,e.channel)=(o.anonymous_id,o.session_id,o.channel)
   and e.event_name<>'app_opened' and e.occurred_at between o.opened_at and o.opened_at+interval '30 minutes'
  group by o.anonymous_id,o.session_id,o.channel
 )
 select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'opened',opened,'q1_started',started,'q1_completed',completed) order by channel),'[]'::jsonb)
 into acquisition
 from (select channel,count(*) as opened,count(started_at) as started,count(*) filter(where started_at<=completed_at) as completed
       from funnel group by channel) f;

 -- Challenges (#18/#35): server truth, independent of product collection.
 select jsonb_build_object(
  'created',(select count(*) from lumen.social_challenges c where c.created_at>=since),
  'senders',(select count(distinct coalesce(c.sender_user_id::text,'a:'||c.sender_anonymous_id)) from lumen.social_challenges c where c.created_at>=since),
  'sent_to_friends',(select count(*) from lumen.social_challenge_invites i where i.created_at>=since),
  'accepted',(select count(*) from lumen.social_challenge_participations p where p.started_at>=since),
  'completed',(select count(*) from lumen.social_challenge_participations p where p.started_at>=since and p.status='completed'),
  'abandoned',(select count(*) from lumen.social_challenge_participations p where p.started_at>=since and p.status='abandoned'),
  'in_progress',(select count(*) from lumen.social_challenge_participations p where p.started_at>=since and p.status='started'),
  'guest_participations',(select count(*) from lumen.social_challenge_participations p where p.started_at>=since and p.participant_user_id is null))
 into challenges;

 -- Défi du jour (#882): only when its tables exist.
 if to_regclass('lumen_commands.daily_runs') is not null then
  select f.enabled into flag from lumen_commands.feature_flags f where f.name='daily_challenge';
  select jsonb_build_object('flag_enabled',coalesce(flag,false),
   'players',count(distinct r.user_id),'days',count(distinct r.day),'runs',count(*),
   'completed',count(*) filter(where r.status='completed'),'abandoned',count(*) filter(where r.status='abandoned'),
   'in_progress',count(*) filter(where r.status='started'))
  into daily from lumen_commands.daily_runs r where r.started_at>=since;
 end if;

 return jsonb_build_object('days',d,'since',since,'generated_at',statement_timestamp(),
  'traffic',traffic,'acquisition',acquisition,'challenges',challenges,'daily',daily,
  'retention_by_channel',jsonb_build_object('measurable',false,'reason','no_persistent_campaign_identifier'));
end $$;

revoke all on function public.lumen_admin_engagement(integer) from public,anon;
grant execute on function public.lumen_admin_engagement(integer) to authenticated;
notify pgrst,'reload schema';
commit;
