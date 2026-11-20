begin;

-- The operator's grant and revoke events are also the source of truth.
-- A later expired grant or revocation never falls back to an earlier grant.
create table lumen_commands.play_review_access_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null check (action in ('grant','revoke')),
 occurred_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz,
 operator_role name not null default session_user,
 check ((action='grant' and expires_at is not null and expires_at>occurred_at)
     or (action='revoke' and expires_at is null))
);
create index play_review_access_events_user_idx
 on lumen_commands.play_review_access_events(user_id,id desc);
alter table lumen_commands.play_review_access_events enable row level security;
revoke all on lumen_commands.play_review_access_events from public,anon,authenticated,service_role;
revoke all on sequence lumen_commands.play_review_access_events_id_seq from public,anon,authenticated,service_role;

create function lumen_commands.can_use_play_review(p_expected_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((
  select e.action='grant' and e.expires_at>statement_timestamp()
  from lumen_commands.play_review_access_events e
  where e.user_id=(select auth.uid()) and e.user_id=p_expected_user_id
  order by e.id desc limit 1
 ),false)
$$;
revoke all on function lumen_commands.can_use_play_review(uuid) from public,anon,authenticated,service_role;
grant execute on function lumen_commands.can_use_play_review(uuid) to authenticated;

create function public.lumen_can_use_play_review(p_expected_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select lumen_commands.can_use_play_review(p_expected_user_id)
$$;
revoke all on function public.lumen_can_use_play_review(uuid) from public,anon,authenticated,service_role;
grant execute on function public.lumen_can_use_play_review(uuid) to authenticated;

alter function lumen_privacy.policy() rename to policy_before_play_review;
create function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable set search_path='' as $$
 select * from lumen_privacy.policy_before_play_review()
 union all select 'lumen_commands','play_review_access_events','user_id',null,null,'delete'
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_play_review() from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();

notify pgrst,'reload schema';
commit;
