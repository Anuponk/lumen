-- #776: exact reference resolution through the existing capability-checked API.
-- Prepared only. Applying this file to production requires separate authorization.
begin;
set local lock_timeout='5s';
do $migration$
declare definition text; needle text; replacement text;
begin
 select pg_get_functiondef('lumen_commands.support(uuid,text,uuid,uuid,jsonb,uuid)'::regprocedure) into definition;
 if strpos(definition,'-- #776 exact-reference')>0 then return;end if;
 needle:=$source$target:=case when admin then p_target_user_id else u end;$source$;
 replacement:=$source$-- #776 exact-reference: capability has already been checked above.
 if admin and p_case_id is not null then
  select user_id into target from lumen_commands.support_cases
   where id=p_case_id and activated_at>=clock_timestamp()-interval '7 days';
  if target is null or (p_target_user_id is not null and p_target_user_id<>target) then
   raise exception using errcode='42501',message='support case unavailable';
  end if;
 else
  target:=case when admin then p_target_user_id else u end;
 end if;$source$;
 if strpos(definition,needle)=0 then raise exception 'Support owner source changed';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$source$where user_id=target order by activated_at desc limit 1 for update;$source$;
 replacement:=$source$where user_id=target and (not admin or p_case_id is null or id=p_case_id) order by activated_at desc limit 1 for update;$source$;
 if strpos(definition,needle)=0 then raise exception 'Support case source changed';end if;
 execute replace(definition,needle,replacement);
end $migration$;
commit;
