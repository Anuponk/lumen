-- Disposable SQL fixture. Use the real privacy inventory and RPC.
begin;
-- Match the schema usage granted by the existing command receipts migration.
grant usage on schema lumen_commands to authenticated;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000079601'),
 ('00000000-0000-0000-0000-000000079602');
insert into lumen.entitlements(user_id,entitlement)
 values ('00000000-0000-0000-0000-000000079601','real-adventure-02');
insert into lumen_commands.play_review_access_events(user_id,action,expires_at)
 values ('00000000-0000-0000-0000-000000079601','grant',now()+interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000079601',true);
do $$begin
 if not public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079601')
  or public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079602')
  or public.lumen_can_use_play_review(null) then raise exception 'invalid account-scoped proof'; end if;
 if has_table_privilege(current_user,'lumen_commands.play_review_access_events','SELECT, INSERT, UPDATE, DELETE')
  or has_function_privilege('anon','public.lumen_can_use_play_review(uuid)','EXECUTE')
  or has_function_privilege('service_role','public.lumen_can_use_play_review(uuid)','EXECUTE') then
  raise exception 'unexpected review access privilege';
 end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000079602',true);
do $$begin
 if public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079601')
  or public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079602') then
  raise exception 'ordinary player obtained review access';
 end if;
end$$;

reset role;
insert into lumen_commands.play_review_access_events(user_id,action,occurred_at,expires_at)
 values ('00000000-0000-0000-0000-000000079601','grant',now()-interval '2 days',now()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000079601',true);
do $$begin
 if public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079601') then
  raise exception 'expired grant fell back to an earlier grant';
 end if;
end$$;

reset role;
insert into lumen_commands.play_review_access_events(user_id,action,expires_at) values
 ('00000000-0000-0000-0000-000000079601','grant',now()+interval '1 day'),
 ('00000000-0000-0000-0000-000000079601','revoke',null);
set local role authenticated;
do $$begin
 if public.lumen_can_use_play_review('00000000-0000-0000-0000-000000079601') then
  raise exception 'revocation did not take effect';
 end if;
end$$;
reset role;
do $$begin
 if (select array_agg(action order by id) from lumen_commands.play_review_access_events)
      is distinct from array['grant','grant','grant','revoke'] then raise exception 'audit history lost'; end if;
 if (select count(*) from lumen.entitlements where user_id='00000000-0000-0000-0000-000000079601')<>1 then
  raise exception 'review changed Adventure entitlements';
 end if;
 if exists(select 1 from lumen.internal_capabilities where user_id='00000000-0000-0000-0000-000000079601') then
  raise exception 'review granted an internal capability';
 end if;
 if not exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='play_review_access_events'
  and uid_col='user_id' and action='delete') then raise exception 'missing review erasure policy'; end if;
end$$;
rollback;
