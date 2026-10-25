-- #534 lot 1: read-only administrative dates, no player/profile rewrite.
-- Indexed latest immutable receipts prove committed domain operations, not
-- acknowledgement by a browser or completion of every outstanding operation.
create index if not exists canonical_receipts_admin_time_idx on lumen_commands.canonical_receipts(user_id,recorded_at desc);
create index if not exists legacy_receipts_admin_time_idx on lumen_commands.legacy_receipts(user_id,recorded_at desc);
create index if not exists wallet_receipts_admin_time_idx on lumen_commands.wallet_receipts(user_id,recorded_at desc);

create function lumen_commands.admin_player_observations(p_player_keys text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c
  where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if cardinality(p_player_keys)>250 then raise exception using errcode='22023',message='too many player keys';end if;
 with keys as (
  select distinct key from unnest(p_player_keys) key
  where key ~ '^u:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 ), players as (
  select k.key,u.id,u.last_sign_in_at from keys k
  join auth.users u on 'u:'||u.id::text=lower(k.key)
  join lumen.users lu on lu.user_id=u.id
 ), rows as (
  select p.key,jsonb_build_object('auth_at',p.last_sign_in_at,
   'domains',jsonb_build_object(
    'canonical',(select r.recorded_at from lumen_commands.canonical_receipts r where r.user_id=p.id order by r.recorded_at desc limit 1),
    'legacy',(select r.recorded_at from lumen_commands.legacy_receipts r where r.user_id=p.id order by r.recorded_at desc limit 1),
    'wallet',(select r.recorded_at from lumen_commands.wallet_receipts r where r.user_id=p.id order by r.recorded_at desc limit 1)),
   'state',case when h.failed then 'failure' when h.pending then 'pending' when h.observed_at is not null then 'confirmed' else 'unknown' end,
   'observed_at',h.observed_at,'oldest_observation_at',h.oldest_at) value
  from players p left join lateral (
   select bool_or(o.state in ('critical','review','auth') or o.failures>0) failed,
    bool_or(o.pending>0 or o.state='pending') pending,max(o.updated_at) observed_at,min(o.updated_at) oldest_at
   from lumen_commands.outbox_health o where o.user_id=p.id
  ) h on true
 ) select jsonb_build_object('observed_at',now(),'players',coalesce(jsonb_object_agg(key,value),'{}'::jsonb)) into result from rows;
 return result;
end $$;
revoke all on function lumen_commands.admin_player_observations(text[]) from public,anon;
-- Invoker facade needs execution; the private function rechecks the live capability.
grant execute on function lumen_commands.admin_player_observations(text[]) to authenticated;
create function public.lumen_admin_player_observations(p_player_keys text[])
returns jsonb language sql stable security invoker set search_path='' as $$
 select lumen_commands.admin_player_observations(p_player_keys);
$$;
revoke all on function public.lumen_admin_player_observations(text[]) from public,anon;
grant execute on function public.lumen_admin_player_observations(text[]) to authenticated;
notify pgrst,'reload schema';
