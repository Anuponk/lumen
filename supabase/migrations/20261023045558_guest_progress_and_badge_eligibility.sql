-- #529: update only the eligibility expression of the deployed command.
-- Preserve the wallet wrapper, immutable receipts, authorization and rewards.
-- No historical badge is backfilled or revoked; this applies to new runs.
do $migration$
declare
 definition text;
 old_rule text:=$rule$v_eligible:=jsonb_build_object('speed',v_index+1>=3 or v_unlocked>=3,'autonomy',v_index+1>=6 or v_unlocked>=6,'noError',v_index+1>=6 or v_unlocked>=6,'mastery',v_index+1>=6 or v_unlocked>=6);$rule$;
 new_rule text:=$rule$v_eligible:=jsonb_build_object('speed',true,'autonomy',true,'noError',true,'mastery',true);$rule$;
begin
 select pg_get_functiondef('lumen_commands.commit_legacy(text,uuid,text,jsonb)'::regprocedure) into definition;
 if strpos(definition,old_rule)>0 then
  execute replace(definition,old_rule,new_rule);
 elsif strpos(definition,new_rule)=0 then
  raise exception 'Badge eligibility source changed; review migration before applying';
 end if;
end $migration$;
