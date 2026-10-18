-- Catalogue cohort metadata only. No player backfill or reward mutation.
-- catalogue-origin-current: 2
-- Revision IDs refer to immutable content/catalogue/access-origins.json.
create or replace function lumen.protect_catalogue_origin()
returns trigger language plpgsql security invoker set search_path='' as $$
declare origin jsonb; expected_origin jsonb;
begin
 origin:=new.payload->'catalogueOrigin';
 if tg_op='INSERT' and origin is null and
    not exists(select 1 from jsonb_each(coalesce(new.payload->'solved','{}')) e where e.value not in ('false','0','null')) and
    not exists(select 1 from jsonb_each(coalesce(new.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true') then
  new.payload:=jsonb_set(new.payload,'{catalogueOrigin}','2');origin:='2';
 end if;
 if origin is not null and origin not in ('1'::jsonb,'2'::jsonb) then
  raise exception 'Unsupported catalogue origin' using errcode='22023';
 end if;
 if tg_op='UPDATE' then
  expected_origin:=old.payload->'catalogueOrigin';
  if expected_origin is null and origin is null and
     not exists(select 1 from jsonb_each(coalesce(old.payload->'solved','{}')) e where e.value not in ('false','0','null')) and
     not exists(select 1 from jsonb_each(coalesce(old.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true') then
   new.payload:=jsonb_set(new.payload,'{catalogueOrigin}','2');origin:='2';
  end if;
  if expected_origin is not null and origin is distinct from expected_origin then
   raise exception 'Catalogue origin cannot be erased or rewritten' using errcode='23514';
  end if;
  if expected_origin is null and origin is not null then
   expected_origin:=case when
    exists(select 1 from jsonb_each(coalesce(old.payload->'solved','{}')) e where e.value not in ('false','0','null')) or
    exists(select 1 from jsonb_each(coalesce(old.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true')
    then '1'::jsonb else '2'::jsonb end;
   if origin is distinct from expected_origin then
    raise exception 'Catalogue origin disagrees with existing cohort' using errcode='23514';
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function lumen.protect_catalogue_origin() from public,anon,authenticated;
create trigger protect_catalogue_origin before insert or update of payload
 on lumen.profile_snapshots for each row execute function lumen.protect_catalogue_origin();
