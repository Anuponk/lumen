begin isolation level repeatable read read only;
do $$declare result jsonb; role_name text; begin
 result:=lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array['rights-guest']);
 if jsonb_array_length(result->'tables'->'lumen.feedback')<>2
  or (select count(*) from jsonb_object_keys(result->'tables'))<>26
  or result::text like '%OTHER_PLAYER_SECRET%'
  or result::text like '%OTHER_APP_SECRET%'
  or result::text like '%AUTH_SECRET%'
  or result::text like '%PUSH_SECRET%'
  or result::text like '%PUSH_KEY%'
  or result::text like '%OTHER_PARTICIPANT_SECRET%'
  or jsonb_array_length(result->'tables'->'lumen_commands.wallet_receipts')<>1
  or jsonb_array_length(result->'tables'->'lumen.social_challenges')<>1
  or jsonb_array_length(result->'tables'->'lumen.social_challenge_participations')<>0
  or not (result->>'thirdPartyReviewRequired')::boolean then
  raise exception 'Rights export scope or redaction failed';
 end if;
 if (select count(*) from lumen.feedback where anonymous_id='rights-guest')<>2
  or not exists(select 1 from fixture_other_app.records where user_id='00000000-0000-0000-0000-000000009401') then
  raise exception 'Export modified source data';
 end if;
 begin
  perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array['rights-guest'],1);
  raise exception 'Row bound accepted';
 exception when program_limit_exceeded then null; end;
 begin
  perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009403',array[]::text[]);
  raise exception 'Byte bound accepted';
 exception when program_limit_exceeded then null; end;
 begin
  perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array[]::text[]);
  raise exception 'Missing actor accepted';
 exception when raise_exception then
  if sqlerrm not like 'LUMEN_ERASURE_ACTOR_REVIEW_REQUIRED%' then raise; end if;
 end;
 begin
  perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009402',array['rights-shared']);
  raise exception 'Shared actor accepted';
 exception when raise_exception then
  if sqlerrm not like 'LUMEN_ERASURE_SHARED_ACTOR%' then raise; end if;
 end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if has_function_privilege(role_name,'lumen_privacy.export_account(uuid,text[],integer)','EXECUTE') then
   raise exception 'API role can export';
  end if;
  execute format('set local role %I',role_name);
  begin
   perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array['rights-guest']);
   raise exception 'API role invoked export';
  exception when insufficient_privilege then null; end;
  reset role;
 end loop;
end $$;
rollback;
