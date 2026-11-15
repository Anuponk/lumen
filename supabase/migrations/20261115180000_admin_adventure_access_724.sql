-- #724: an internal administrator grants or revokes a locked Adventure for one player.
-- Server-authoritative: the capability, the target and the Adventure are checked here,
-- never trusted from the browser. Re-applying this migration is safe.
-- Revocation expires the entitlement (row kept, expires_at set); it never touches
-- progress. Adventures already started stay playable through the acquired-access
-- policy of PROGRESSION.md. Future purchases will reuse lumen.entitlements.
begin;

create table if not exists lumen_commands.adventure_access_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor uuid references auth.users(id) on delete set null,
 adventure text not null check (adventure ~ '^real-adventure-[0-9]{2}$' and adventure<>'real-adventure-01'),
 action text not null check (action in ('grant','revoke')),
 reason text not null check (char_length(reason) between 3 and 200),
 occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists adventure_access_audit_user_idx on lumen_commands.adventure_access_audit(user_id,occurred_at desc);
alter table lumen_commands.adventure_access_audit enable row level security;
revoke all on lumen_commands.adventure_access_audit from public,anon,authenticated;
comment on table lumen_commands.adventure_access_audit is
 '#724 operator accountability for Adventure grants/revocations. Deleted with the player on Lumen erasure; actor is an internal administrator (export: third-party review).';

create or replace function lumen_commands.admin_adventure_access(
 p_expected_user_id uuid,p_action text,p_target_user_id uuid,p_adventure text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); why text:=nullif(btrim(coalesce(p_reason,'')),''); changed boolean:=false; active boolean;
begin
 if u is null or u is distinct from p_expected_user_id then
  raise exception using errcode='42501',message='admin account mismatch';end if;
 if not exists(select 1 from lumen.internal_capabilities x where x.user_id=u and x.capability='analytics_cockpit'
  and (x.expires_at is null or x.expires_at>clock_timestamp())) then
  raise exception using errcode='42501',message='adventure access capability required';end if;
 if p_action is null or p_action not in ('list','grant','revoke') then
  raise exception using errcode='22023',message='invalid adventure access action';end if;
 if p_target_user_id is null or not exists(select 1 from auth.users a where a.id=p_target_user_id) then
  raise exception using errcode='22023',message='unknown player';end if;
 if p_action in ('grant','revoke') then
  if p_adventure is null or p_adventure !~ '^real-adventure-[0-9]{2}$' or p_adventure='real-adventure-01' then
   raise exception using errcode='22023',message='invalid adventure';end if;
  if why is null or char_length(why) not between 3 and 200 then
   raise exception using errcode='22023',message='reason required';end if;
  -- One decision at a time per player and Adventure; a retry observes the first result.
  perform pg_advisory_xact_lock(724,hashtext(p_target_user_id::text||'/'||p_adventure));
  select e.expires_at is null or e.expires_at>clock_timestamp() into active
   from lumen.entitlements e where e.user_id=p_target_user_id and e.entitlement=p_adventure;
  active:=coalesce(active,false);
  if p_action='grant' and not active then
   insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source)
    values(p_target_user_id,p_adventure,clock_timestamp(),null,'admin')
    on conflict(user_id,entitlement) do update set granted_at=excluded.granted_at,expires_at=null,source='admin';
   changed:=true;
  elsif p_action='revoke' and active then
   update lumen.entitlements set expires_at=clock_timestamp()
    where user_id=p_target_user_id and entitlement=p_adventure;
   changed:=true;
  end if;
  if changed then
   insert into lumen_commands.adventure_access_audit(user_id,actor,adventure,action,reason)
    values(p_target_user_id,u,p_adventure,p_action,why);
  end if;
 end if;
 return jsonb_build_object(
  'changed',changed,
  'adventures',coalesce((select jsonb_agg(jsonb_build_object('adventure',e.entitlement,'source',e.source,
    'granted_at',e.granted_at,'expires_at',e.expires_at,
    'active',e.expires_at is null or e.expires_at>clock_timestamp()) order by e.entitlement)
   from lumen.entitlements e where e.user_id=p_target_user_id and e.entitlement ~ '^real-adventure-[0-9]{2}$'),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(jsonb_build_object('adventure',h.adventure,'action',h.action,'reason',h.reason,
    'occurred_at',h.occurred_at) order by h.occurred_at desc,h.id desc)
   from (select * from lumen_commands.adventure_access_audit a where a.user_id=p_target_user_id
    order by a.occurred_at desc,a.id desc limit 20) h),'[]'::jsonb));
end $$;
revoke all on function lumen_commands.admin_adventure_access(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function lumen_commands.admin_adventure_access(uuid,text,uuid,text,text) to authenticated;

create or replace function public.lumen_admin_adventure_access(
 p_expected_user_id uuid,p_action text,p_target_user_id uuid,p_adventure text default null,p_reason text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select lumen_commands.admin_adventure_access(p_expected_user_id,p_action,p_target_user_id,p_adventure,p_reason);
$$;
revoke all on function public.lumen_admin_adventure_access(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.lumen_admin_adventure_access(uuid,text,uuid,text,text) to authenticated;

-- Keep inventory, erasure/export and anti-resurrection aware of the audit table.
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null
  and to_regprocedure('lumen_privacy.policy_before_adventure_access()') is null then
  alter function lumen_privacy.policy() rename to policy_before_adventure_access;
 end if;
 if to_regprocedure('lumen_privacy.policy_before_adventure_access()') is not null then
  execute $f$create or replace function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_adventure_access()
    union all select 'lumen_commands','adventure_access_audit','user_id',null,null,'delete'
   $b$$f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_adventure_access() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;
notify pgrst,'reload schema';
commit;
