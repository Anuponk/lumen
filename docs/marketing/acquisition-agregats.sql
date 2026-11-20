-- Lecture seule sur une connexion d'administration autorisée.
-- 7 jours glissants. NULL indique que le signal d'invitation n'a pas été observé.
begin transaction read only;

select nullif(count(*), 0) as clics_invitation_observes
from lumen.analytics_events e
where event_name = 'share_result'
  and occurred_at >= statement_timestamp() - interval '7 days'
  and occurred_at <= statement_timestamp()
  and properties->>'share_action' = 'invite_clicked'
  and properties->>'traffic_type' = 'human'
  and coalesce(properties->>'qa_mode', '') = ''
  and not exists (
    select 1
    from lumen.analytics_events as conflicting_traffic
    where conflicting_traffic.anonymous_id = e.anonymous_id
      and conflicting_traffic.occurred_at between statement_timestamp() - interval '7 days' and statement_timestamp()
      and (
        conflicting_traffic.properties->>'traffic_type' in ('qa', 'automated_test')
        or coalesce(conflicting_traffic.properties->>'qa_mode', '') <> ''
      )
  );

with events as (
  select anonymous_id, session_id, event_name, occurred_at,
         properties->>'acquisition_channel' as channel
  from lumen.analytics_events e
  where event_name in ('app_opened', 'attempt_started', 'attempt_completed')
    and occurred_at >= statement_timestamp() - interval '7 days'
    and occurred_at <= statement_timestamp()
    and properties->>'acquisition_channel' in ('player_share', 'youtube_shorts', 'instagram_reels', 'tiktok')
    and properties->>'traffic_type' = 'human'
    and coalesce(properties->>'qa_mode', '') = ''
    and not exists (
      select 1
      from lumen.analytics_events as conflicting_traffic
      where conflicting_traffic.anonymous_id = e.anonymous_id
        and conflicting_traffic.occurred_at between statement_timestamp() - interval '7 days' and statement_timestamp()
        and (
          conflicting_traffic.properties->>'traffic_type' in ('qa', 'automated_test')
          or coalesce(conflicting_traffic.properties->>'qa_mode', '') <> ''
        )
    )
    and (
      event_name = 'app_opened'
      or (
        properties->>'quest_ordinal' = '1'
        and properties->>'attempt_mode' = 'campaign'
        and (event_name = 'attempt_started' or (
          properties->>'outcome' = 'success' and properties->>'first_completion' = 'true'
        ))
      )
    )
), opens as (
  select anonymous_id, session_id, channel, min(occurred_at) as opened_at
  from events
  where event_name = 'app_opened'
  group by anonymous_id, session_id, channel
), funnel as (
  select o.channel, min(e.occurred_at) filter (where e.event_name = 'attempt_started') as started_at,
         max(e.occurred_at) filter (where e.event_name = 'attempt_completed') as completed_at
  from opens o
  left join events e
    on (e.anonymous_id, e.session_id, e.channel) = (o.anonymous_id, o.session_id, o.channel)
   and e.event_name <> 'app_opened'
   and e.occurred_at between o.opened_at and o.opened_at + interval '30 minutes'
  group by o.anonymous_id, o.session_id, o.channel
)
select channel, count(*) as sessions_jeu_observees,
       count(started_at) as sessions_avec_debut_quete_1,
       count(*) filter (where started_at <= completed_at) as sessions_avec_premiere_reussite_quete_1
from funnel
group by channel
order by channel;

rollback;
