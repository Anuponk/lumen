-- Issue #112: isolate Lumen users inside the shared SoldeZen Supabase project.
create table if not exists lumen.users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
alter table lumen.users enable row level security;

-- Backfill only users with existing Lumen-owned data. SoldeZen-only accounts are excluded.
insert into lumen.users(user_id,first_seen_at,last_seen_at)
select user_id,min(seen_at),max(seen_at)
from (
 select user_id,created_at seen_at from lumen.profiles where user_id is not null
 union all select user_id,occurred_at from lumen.analytics_events where user_id is not null
 union all select user_id,updated_at from lumen.progress where user_id is not null
) s group by user_id
on conflict(user_id) do update set last_seen_at=greatest(lumen.users.last_seen_at,excluded.last_seen_at);

create or replace function public.lumen_register_user()
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 insert into lumen.users(user_id) values(auth.uid())
 on conflict(user_id) do update set last_seen_at=now();
end $$;
revoke all on function public.lumen_register_user() from public,anon;
grant execute on function public.lumen_register_user() to authenticated;

create or replace function public.lumen_admin_accounts(p_limit integer default 250)
returns table(user_id uuid,email text,created_at timestamptz,last_sign_in_at timestamptz,nickname text,last_activity timestamptz,current_quest integer)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;
 return query
 select u.id,u.email::text,u.created_at,u.last_sign_in_at,p.nickname,a.last_activity,a.current_quest
 from lumen.users lu join auth.users u on u.id=lu.user_id
 left join lumen.profiles p on p.user_id=u.id
 left join lateral (
   select max(e.occurred_at) last_activity,max(e.puzzle_id) filter(where e.event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) current_quest
   from lumen.analytics_events e where e.user_id=u.id and coalesce(e.properties->>'qa_mode','')='' and coalesce(e.properties->>'traffic_type','human')='human'
 ) a on true order by lu.last_seen_at desc limit greatest(1,least(coalesce(p_limit,250),1000));
end $$;
revoke all on function public.lumen_admin_accounts(integer) from public,anon;
grant execute on function public.lumen_admin_accounts(integer) to authenticated,service_role;
