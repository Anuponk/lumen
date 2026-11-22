-- #962: distinguish ranking guard failures without changing admission or scoring.
begin;
set local lock_timeout='5s';

create or replace function lumen_commands.ranking_finish(p_operation_id text,p_hint_uses integer,p_verify_uses integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r lumen_commands.ranking_runs%rowtype;request jsonb;facts jsonb;raw integer;penalty integer;old_score integer;improved boolean;v_counts jsonb;res jsonb;
begin
 if u is null then raise insufficient_privilege;end if;
 if p_hint_uses is null or p_verify_uses is null or p_hint_uses not between 0 and 10000 or p_verify_uses not between 0 and 10000 then
  raise invalid_parameter_value using message='ranking_finish_invalid_counts';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 select * into r from lumen_commands.ranking_runs where user_id=u and operation_id=p_operation_id for update;
 if not found then raise invalid_parameter_value using message='ranking_finish_run_missing';end if;
 v_counts:=jsonb_build_object('hint',p_hint_uses,'verify',p_verify_uses);
 if r.result is not null then
  if r.counts is distinct from v_counts then raise invalid_parameter_value using message='ranking_finish_retry_counts_mismatch';end if;
  return r.result||jsonb_build_object('improved',false);
 end if;
 if not exists(select 1 from lumen_commands.ranking_members where user_id=u and participating) then return jsonb_build_object('status','membership_required');end if;
 select c.request into request from lumen_commands.canonical_receipts c where c.user_id=u and c.operation_id=p_operation_id;
 if request is null then select c.request into request from lumen_commands.legacy_receipts c where c.user_id=u and c.operation_id=p_operation_id;end if;
 if request is null then return jsonb_build_object('status','pending');end if;
 if request->>'questId' is distinct from r.quest_id then raise invalid_parameter_value using message='ranking_finish_quest_mismatch';end if;
 facts:=request->'facts';
 if facts is null then raise invalid_parameter_value using message='ranking_finish_facts_missing';end if;
 if (facts->>'qualifiedAt')::timestamptz<>r.started_at then raise invalid_parameter_value using message='ranking_finish_started_at_mismatch';end if;
 if (facts->>'hintUsed')::boolean<>(p_hint_uses>0) then raise invalid_parameter_value using message='ranking_finish_hint_flag_mismatch';end if;
 if not (facts->>'assistanceUsed')::boolean and p_hint_uses+p_verify_uses>0 then
  raise invalid_parameter_value using message='ranking_finish_assistance_flag_mismatch';
 end if;
 if facts ? 'timing' then
  begin
   perform lumen_commands.official_time(facts,r.grid_revision);
  exception when invalid_parameter_value then
   raise invalid_parameter_value using message='ranking_finish_invalid_official_timing';
  end;
  if p_hint_uses<>(facts#>>'{timing,helpUses,hint}')::integer or p_verify_uses<>(facts#>>'{timing,helpUses,verify}')::integer+(facts#>>'{timing,helpUses,guided}')::integer then
   raise invalid_parameter_value using message='ranking_finish_official_counts_mismatch';
  end if;
 end if;
 raw:=(facts->>'seconds')::integer;
 if raw<0 or raw>extract(epoch from clock_timestamp()-r.started_at)+5 then
  raise invalid_parameter_value using message='ranking_finish_seconds_out_of_range';
 end if;
 if not r.eligible or not (facts->>'qualifying')::boolean or not exists(select 1 from lumen_commands.quest_rules where quest_id=r.quest_id and grid_revision=r.grid_revision) then
  res:=jsonb_build_object('status','ineligible','questId',r.quest_id,'improved',false);
 else
  penalty:=p_hint_uses*15+p_verify_uses*5;
  select score into old_score from lumen_commands.ranking_scores where user_id=u and quest_id=r.quest_id and grid_revision=r.grid_revision;
  improved:=old_score is null or raw+penalty<old_score;
  if improved then
   insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(u,r.quest_id,r.grid_revision,raw,penalty)
    on conflict(user_id,quest_id,grid_revision) do update set seconds=excluded.seconds,penalty=excluded.penalty;
  end if;
  res:=jsonb_build_object('status','confirmed','questId',r.quest_id,'improved',improved);
 end if;
 update lumen_commands.ranking_runs set counts=v_counts,result=res where user_id=u and operation_id=p_operation_id;
 return res;
end $$;

commit;
