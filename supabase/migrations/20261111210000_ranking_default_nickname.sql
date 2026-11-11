-- Default ranking participation for authenticated players with a validated nickname.
-- Preserve explicit withdrawals from this version onward independently from legacy opt-outs.
begin;
alter table lumen.profiles add column if not exists ranking_withdrawn_explicit boolean not null default false;

-- Pre-existing opt-outs may include legacy migration defaults. Do not silently
-- publish them: a user with a valid nickname can rejoin explicitly.
create or replace function lumen_commands.set_nickname(p_nickname text) returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v text:=btrim(p_nickname);
begin
 if u is null then raise insufficient_privilege;end if;
 if v is null or char_length(v) not between 3 and 20 or v !~ '^[[:alnum:]][[:alnum:] _.-]*$' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 insert into lumen.profiles(user_id,nickname,nickname_ready)
 values(u,v,true)
 on conflict(user_id) do update set nickname=excluded.nickname,nickname_ready=true,updated_at=clock_timestamp();
 update lumen_commands.ranking_members set nickname=v where user_id=u;
 -- Fresh profiles participate by default. Never undo an explicit withdrawal.
 if not exists(select 1 from lumen.profiles where user_id=u and (ranking_opted_out or ranking_withdrawn_explicit)) then
  insert into lumen_commands.ranking_members(user_id,nickname,participating) values(u,v,true)
  on conflict(user_id) do update set nickname=excluded.nickname,participating=true;
 end if;
 return v;
end $$;

create or replace function lumen_commands.ranking_membership(p_enabled boolean,p_nickname text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p lumen.profiles%rowtype;
begin
 if u is null then raise insufficient_privilege;end if;
 if p_enabled is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 insert into lumen.profiles(user_id) values(u) on conflict do nothing;
 select * into p from lumen.profiles where user_id=u for update;
 if p_enabled then
  if not p.nickname_ready then raise invalid_parameter_value using message='nickname_required';end if;
  update lumen.profiles set ranking_opted_out=false,ranking_withdrawn_explicit=false where user_id=u;
  insert into lumen_commands.ranking_members(user_id,nickname,participating) values(u,btrim(p.nickname),true)
   on conflict(user_id) do update set nickname=excluded.nickname,participating=true;
 else
  update lumen.profiles set ranking_opted_out=true,ranking_withdrawn_explicit=true where user_id=u;
  delete from lumen_commands.ranking_scores where user_id=u;
  delete from lumen_commands.ranking_members where user_id=u;
 end if;
 return jsonb_build_object('participating',p_enabled);
end $$;

create or replace function lumen_commands.ranking_auto(p_started_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p lumen.profiles%rowtype;
begin
 if u is null then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 if not exists(select 1 from lumen_commands.ranking_control where p_started_at>=automatic_after) then return;end if;
 select * into p from lumen.profiles where user_id=u for update;
 if not found or p.ranking_opted_out or p.ranking_withdrawn_explicit or not p.nickname_ready then return;end if;
 insert into lumen_commands.ranking_members(user_id,nickname,participating) values(u,btrim(p.nickname),true)
 on conflict(user_id) do update set nickname=excluded.nickname,participating=true;
end $$;
commit;
