begin isolation level repeatable read read only;
do $$declare result jsonb; begin
 result:=lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array['rights-guest']);
 if exists(select 1 from jsonb_each(result->'tables') t where jsonb_array_length(t.value)<>0)
  or jsonb_array_length(result->'erasureBarrier')<>4
  or not exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000009401')
  or not exists(select 1 from fixture_other_app.records where user_id='00000000-0000-0000-0000-000000009401') then
  raise exception 'Post-erasure rights scope failed';
 end if;
end $$;
rollback;
