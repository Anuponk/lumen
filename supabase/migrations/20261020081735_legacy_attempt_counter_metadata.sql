-- Cumulative attempts are summary metadata, not proof of a reward. Permit only
-- a monotonic counter change through the existing authenticated snapshot/CAS
-- path. Keep every other protected reward/evidence field and revision exact.
-- No profile backfill, receipt rewrite, new public endpoint or Auth change.
create function lumen_commands.legacy_attempt_count(p_value jsonb) returns integer
language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_value is null then return 0;end if;
 if jsonb_typeof(p_value) is distinct from 'number' then
  raise exception using errcode='22023',message='invalid historical attempt counter';end if;
 -- Match the existing command writer's PostgreSQL integer representation.
 if p_value::text !~ '^(0|[1-9][0-9]{0,9})$' then
  raise exception using errcode='22023',message='invalid historical attempt counter';end if;
 if p_value::text::bigint>2147483647 then
  raise exception using errcode='22023',message='invalid historical attempt counter';end if;
 return p_value::text::integer;
end $$;

create function lumen_commands.legacy_reward_projection(p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_set(lumen_commands.legacy_projection(p),'{performances}',
  coalesce((select jsonb_object_agg(key,value-'attempts')
   from jsonb_each(lumen_commands.legacy_projection(p)->'performances')),'{}'));
$$;

create or replace function lumen_commands.protect_legacy_authority() returns trigger
language plpgsql security definer set search_path='' as $$
declare v lumen_commands.legacy_authority%rowtype;v_entry record;
 v_next integer;v_floor integer;
begin
 -- Snapshot writers and command writers already lock the profile row first.
 select * into v from lumen_commands.legacy_authority where user_id=new.user_id for update;
 if not found then return new;end if;
 if (new.payload->'legacyVictoryRevision') is distinct from to_jsonb(v.revision)
  or lumen_commands.legacy_reward_projection(new.payload) is distinct from lumen_commands.legacy_reward_projection(v.projection)
 then raise exception using errcode='22023',message='legacy victory command required; preserve pending data and update client';end if;
 for v_entry in select key,value from jsonb_each(coalesce(new.payload->'performances','{}')) loop
  v_next:=lumen_commands.legacy_attempt_count(v_entry.value->'attempts');
  v_floor:=lumen_commands.legacy_attempt_count(v.projection#>array['performances',v_entry.key,'attempts']);
  if tg_op='UPDATE' then
   v_floor:=greatest(v_floor,lumen_commands.legacy_attempt_count(old.payload#>array['performances',v_entry.key,'attempts']));
  end if;
  if v_next<v_floor then
   raise exception using errcode='22023',message='historical attempt counter cannot decrease';end if;
 end loop;
 -- Preserve the pre-existing cumulative XP guard.
 if tg_op='UPDATE' and (jsonb_typeof(new.payload->'xp') is distinct from 'number'
  or (new.payload->>'xp') !~ '^[0-9]{1,15}$'
  or (new.payload->>'xp')::bigint<coalesce((old.payload->>'xp')::bigint,0))
 then raise exception using errcode='22023',message='earned XP cannot decrease';end if;
 -- Maintain the full authority projection atomically, including accepted stats,
 -- without minting a victory revision or changing an immutable receipt.
 -- Keeping the projection exact also preserves compatibility with the old guard.
 update lumen_commands.legacy_authority set projection=lumen_commands.legacy_projection(new.payload)
 where user_id=new.user_id and projection is distinct from lumen_commands.legacy_projection(new.payload);
 return new;
end $$;
revoke all on function lumen_commands.legacy_attempt_count(jsonb),lumen_commands.legacy_reward_projection(jsonb),lumen_commands.protect_legacy_authority() from public,anon,authenticated;
