-- Disposable transaction: demonstrate absence without assuming production state.
begin;
drop table lumen_commands.support_contents,lumen_commands.support_captures,
 lumen_commands.support_access,lumen_commands.support_cases,lumen_commands.support_control cascade;
do $$declare u uuid:=gen_random_uuid();begin
 insert into auth.users(id) values(u);
 assert lumen_privacy.review_erasure(u,array[]::text[])->>'authDeleted'='false';
 assert lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u)->>'status'='erased';
 assert exists(select 1 from auth.users where id=u);
end $$;
create table lumen_commands.support_control(singleton boolean primary key,enabled boolean);
do $$begin
 begin perform lumen_privacy.review_erasure(gen_random_uuid(),array[]::text[]);raise exception 'Partial support accepted';
 exception when raise_exception then assert sqlerrm='LUMEN_ERASURE_SUPPORT_SCHEMA_REVIEW_REQUIRED';end;
end $$;
rollback;
