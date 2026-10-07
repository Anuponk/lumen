-- Issue #112: capability-protected account directory for the Lumen admin cockpit.
-- Emails remain authentication data: they are never copied into analytics events.

create or replace function public.lumen_admin_accounts(p_limit integer default 250)
returns table(user_id uuid,email text,created_at timestamptz,last_sign_in_at timestamptz,nickname text,last_activity timestamptz,current_quest integer)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists(
   select 1 from lumen.internal_capabilities c
   where c.user_id=auth.uid() and c.capability='analytics_cockpit'
     and (c.expires_at is null or c.expires_at>now())
 ) then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;

 return query
 select u.id,u.email::text,u.created_at,u.last_sign_in_at,p.nickname,a.last_activity,a.current_quest
 from auth.users u
 left join lumen.profiles p on p.user_id=u.id
 left join lateral (
   select max(e.occurred_at) last_activity,
     max(e.puzzle_id) filter(where e.event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) current_quest
   from lumen.analytics_events e
   where e.user_id=u.id and coalesce(e.properties->>'qa_mode','')=''
     and coalesce(e.properties->>'traffic_type','human')='human'
 ) a on true
 order by u.created_at desc
 limit greatest(1,least(coalesce(p_limit,250),1000));
end $$;

revoke all on function public.lumen_admin_accounts(integer) from public,anon;
grant execute on function public.lumen_admin_accounts(integer) to authenticated,service_role;
