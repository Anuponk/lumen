-- Prepared only: owner-session export, never a public RPC or an Auth export.
create function lumen_privacy.export_account(
 p_user_id uuid,p_verified_actors text[],p_max_rows integer default 10000
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 r record; predicate text; n bigint; bytes bigint; total_rows bigint:=0;
 total_bytes bigint:=0; report jsonb; tables jsonb:='{}'; rows_json jsonb;
 actors text[]:=coalesce(p_verified_actors,array[]::text[]); keys text[];
 barrier jsonb; expression text;
begin
 if auth.uid() is not null then
  raise exception using errcode='42501',message='Operator database session required';
 end if;
 if current_setting('transaction_read_only')<>'on'
  or current_setting('transaction_isolation') not in ('repeatable read','serializable') then
  raise exception using errcode='25000',message='LUMEN_EXPORT_REQUIRES_STABLE_READ_ONLY_TRANSACTION';
 end if;
 if p_max_rows is null or p_max_rows not between 1 and 10000 then
  raise exception using errcode='22023',message='Invalid export bound';
 end if;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 keys:=array['u:'||p_user_id::text]||array(select 'a:'||a from unnest(actors) a);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.kind,e.digest),'[]') into barrier
 from lumen_privacy.erased_identifiers e where
  (e.kind='user' and e.digest=lumen_privacy.fingerprint(p_user_id::text))
  or (e.kind='actor' and e.digest in (select lumen_privacy.fingerprint(a) from unnest(actors) a))
  or (e.kind='key' and e.digest in (select lumen_privacy.fingerprint(k) from unnest(keys) k));
 total_rows:=jsonb_array_length(barrier);
 total_bytes:=pg_column_size(barrier);
 -- Preflight every category before materializing the combined JSON. Never truncate.
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  predicate:=concat_ws(' or ',
   case when r.uid_col is not null then format('%I=$1',r.uid_col) end,
   case when r.actor_col is not null then format('%I::text=any($2)',r.actor_col) end,
   case when r.key_col is not null then format('%I=any($3)',r.key_col) end);
  execute format('select count(*),coalesce(sum(pg_column_size(to_jsonb(t))),0) from %I.%I t where %s',r.ns,r.rel,predicate)
   into n,bytes using p_user_id,actors,keys;
  if n<>(report->'tables'->(r.ns||'.'||r.rel)->>'rows')::bigint then
   raise exception 'LUMEN_EXPORT_VISIBILITY_REVIEW_REQUIRED';
  end if;
  total_rows:=total_rows+n; total_bytes:=total_bytes+bytes;
  if total_rows>p_max_rows or total_bytes>8388608 then
   raise exception using errcode='54000',message='LUMEN_EXPORT_BOUND_EXCEEDED_REVIEW_REQUIRED';
  end if;
 end loop;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  predicate:=concat_ws(' or ',
   case when r.uid_col is not null then format('%I=$1',r.uid_col) end,
   case when r.actor_col is not null then format('%I::text=any($2)',r.actor_col) end,
   case when r.key_col is not null then format('%I=any($3)',r.key_col) end);
  expression:='to_jsonb(t)';
  if r.ns='public' and r.rel='lumen_push_subscriptions' then
   expression:='case when jsonb_typeof(to_jsonb(t)->''subscription'')=''object'' then jsonb_set(to_jsonb(t),''{subscription}'',(to_jsonb(t)->''subscription'')-''keys'') else to_jsonb(t) end';
  end if;
  execute format('select coalesce(jsonb_agg(%s order by to_jsonb(t)::text),''[]'') from %I.%I t where %s',expression,r.ns,r.rel,predicate)
   into rows_json using p_user_id,actors,keys;
  tables:=tables||jsonb_build_object(r.ns||'.'||r.rel,rows_json);
 end loop;
 return jsonb_build_object('scope','Lumen only','formatVersion',1,'userId',p_user_id,
  'capturedAt',transaction_timestamp(),'tables',tables,'erasureBarrier',barrier,
  'thirdPartyReviewRequired',true,'omittedTechnicalFields',jsonb_build_array('push subscription.keys'),
  'authIncluded',false,'restoreSupported',false);
end $$;
revoke all on function lumen_privacy.export_account(uuid,text[],integer) from public,anon,authenticated,service_role;
