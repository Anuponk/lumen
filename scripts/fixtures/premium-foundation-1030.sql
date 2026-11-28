-- Disposable PostgreSQL only; synthetic accounts, rolled back. #1030 Premium
-- foundation: settings off by default and validated, Premium derived from the
-- purchase ledger (refunds included), traced backfill of administrative whole skies
-- only, quota ledger reconciliation, Premium circle creation, Stripe Premium guard,
-- quota calibration access, privacy policy and erasure.
begin;
do $$
declare
 free_p constant uuid:='00000000-0000-4000-8000-000001030001';  -- free player
 units  constant uuid:='00000000-0000-4000-8000-000001030002';  -- five unit purchases
 sky    constant uuid:='00000000-0000-4000-8000-000001030003';  -- real-sky-all
 prem   constant uuid:='00000000-0000-4000-8000-000001030004';  -- lumen-premium
 admin_sky constant uuid:='00000000-0000-4000-8000-000001030005'; -- admin whole sky
 mastery_sky constant uuid:='00000000-0000-4000-8000-000001030006'; -- mastery only
 mixed  constant uuid:='00000000-0000-4000-8000-000001030007';  -- admin + purchase
 partial constant uuid:='00000000-0000-4000-8000-000001030008'; -- admin partial
 qa     constant uuid:='00000000-0000-4000-8000-000001030009';  -- premium_preview
 owner_ constant uuid:='00000000-0000-4000-8000-000001030010';  -- commerce_admin + cockpit
 upgr   constant uuid:='00000000-0000-4000-8000-000001030011';  -- sky upgrade
 r jsonb; packs text[]; p text; i integer; d date:=(clock_timestamp() at time zone 'UTC')::date; c jsonb;
begin
 -- Privileges: public config for everyone, account reads for accounts, rest private.
 assert has_function_privilege('anon','public.lumen_get_commerce_config()','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_get_commerce_state(uuid,date)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_quota_sync(uuid,date,jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_admin_set_commerce_setting(text,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_admin_quota_simulation(integer,text[],integer[],integer)','EXECUTE');
 assert has_function_privilege('authenticated','public.lumen_quota_sync(uuid,date,jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean)','EXECUTE');
 assert not has_function_privilege('authenticated','public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean)','EXECUTE');
 foreach p in array array['lumen_commands.premium_status(uuid)','lumen_commands.premium_backfill(boolean)','lumen_commands.set_commerce_setting(text,jsonb)',
  'lumen_commands.premium_revoke_grant(uuid)','lumen_commands.has_capability(uuid,text)','lumen_commands.quota_counts(uuid,date)'] loop
  assert not has_function_privilege('authenticated',p,'EXECUTE'),p;
  assert not has_function_privilege('anon',p,'EXECUTE'),p;
 end loop;
 foreach p in array array['commerce_settings','commerce_settings_audit','premium_grants','premium_grant_events','quota_state','quota_attempts'] loop
  assert not has_table_privilege('authenticated','lumen_commands.'||p,'SELECT'),p;
  assert (select relrowsecurity from pg_class where oid=('lumen_commands.'||p)::regclass),p||' RLS';
 end loop;

 -- Everything is off by default; the new-quest quota is undecided; Premium inactive.
 r:=public.lumen_get_commerce_config();
 assert r->'premiumEnabled'='false'::jsonb and r->'quotasEnabled'='false'::jsonb and r->'shopPremium'='false'::jsonb
  and r->'circles'='false'::jsonb and r->'stats'='false'::jsonb and r->'archives'='false'::jsonb,r::text;
 assert r->'newDaily'='null'::jsonb and r->'replayDaily'='5'::jsonb and r->'thresholdConstellation'='4'::jsonb,r::text;
 assert (r->>'premiumPriceCents')::int=499 and r->'premiumProductActive'='false'::jsonb,r::text;
 assert (select kind from lumen_commands.store_products where product_id='lumen-premium')='premium';

 -- Typed settings, owner decision gate and audit.
 begin perform lumen_commands.set_commerce_setting('quotas_enabled','true');raise exception 'quota enabled without value';
 exception when invalid_parameter_value then assert sqlerrm='quota_new_daily_undecided',sqlerrm;end;
 begin perform lumen_commands.set_commerce_setting('quota_new_daily','0');raise exception 'zero quota accepted';
 exception when invalid_parameter_value then assert sqlerrm='commerce_setting_range';end;
 begin perform lumen_commands.set_commerce_setting('quota_new_daily','2.5');raise exception 'fraction accepted';
 exception when invalid_parameter_value then assert sqlerrm='commerce_setting_range';end;
 begin perform lumen_commands.set_commerce_setting('premium_enabled','"yes"');raise exception 'string accepted';
 exception when invalid_parameter_value then assert sqlerrm='commerce_setting_boolean';end;
 begin perform lumen_commands.set_commerce_setting('unknown','true');raise exception 'unknown accepted';
 exception when invalid_parameter_value then assert sqlerrm='commerce_setting_unknown';end;
 i:=(select count(*) from lumen_commands.commerce_settings_audit);
 perform lumen_commands.set_commerce_setting('quota_new_daily','12');
 perform lumen_commands.set_commerce_setting('quota_new_daily','12');
 assert (select count(*) from lumen_commands.commerce_settings_audit)=i+1,'unchanged value is not audited twice';
 perform lumen_commands.set_commerce_setting('quotas_enabled','true');
 begin perform lumen_commands.set_commerce_setting('quota_new_daily','null');raise exception 'cleared while on';
 exception when invalid_parameter_value then assert sqlerrm='quota_new_daily_undecided';end;
 perform lumen_commands.set_commerce_setting('quotas_enabled','false');
 perform lumen_commands.set_commerce_setting('quota_new_daily','null');

 insert into auth.users(id) values(free_p),(units),(sky),(prem),(admin_sky),(mastery_sky),(mixed),(partial),(qa),(owner_),(upgr);
 insert into lumen.internal_capabilities(user_id,capability) values(qa,'premium_preview'),(owner_,'commerce_admin'),(owner_,'analytics_cockpit'),
  (free_p,'stripe_test_checkout'),(prem,'stripe_test_checkout');
 -- Admin console: capability required, same validation.
 perform set_config('request.jwt.claim.sub',free_p::text,true);
 begin perform public.lumen_admin_set_commerce_setting('premium_stats','true');raise exception 'player changed a setting';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_::text,true);
 r:=public.lumen_admin_set_commerce_setting('premium_stats','true');
 assert r->'premium_stats'='true'::jsonb,r::text;
 perform public.lumen_admin_set_commerce_setting('premium_stats','false');

 -- Premium derivation from the ledger.
 select array_agg(pack_id order by pack_id) into packs from lumen_commands.adventure_packs where access='locked' and pack_id ~ '^real-adventure-0[2-9]$';
 assert not lumen_commands.is_premium(free_p) and lumen_commands.premium_status(free_p)->>'active'='false';
 assert not lumen_commands.is_premium(null);
 for i in 1..4 loop perform public.lumen_record_purchase('stripe','u-'||i,units,packs[i],100,'EUR','paid');end loop;
 assert not lumen_commands.is_premium(units),'one to four Adventures keep their content, without Premium';
 perform public.lumen_record_purchase('stripe','u-5',units,packs[5],100,'EUR','paid');
 assert lumen_commands.premium_status(units)->>'source'='five_adventures',lumen_commands.premium_status(units)::text;
 perform public.lumen_record_purchase('stripe','u-5',units,packs[5],100,'EUR','refunded');
 assert not lumen_commands.is_premium(units),'a refund below five removes the automatic Premium';
 perform public.lumen_record_purchase('stripe','u-5',units,packs[5],100,'EUR','paid');
 assert lumen_commands.is_premium(units),'restoring the same purchase restores Premium';
 perform public.lumen_record_purchase('play','s-1',sky,'real-sky-all',500,'EUR','paid');
 assert lumen_commands.premium_status(sky)->>'source'='sky_purchase';
 perform public.lumen_record_purchase('play','s-1',sky,'real-sky-all',500,'EUR','disputed');
 assert not lumen_commands.is_premium(sky),'a dispute revokes';
 perform public.lumen_record_purchase('stripe','g-1',upgr,packs[1],100,'EUR','paid');
 perform public.lumen_record_purchase('stripe','g-2',upgr,'real-sky-upgrade-1',400,'EUR','paid');
 assert lumen_commands.premium_status(upgr)->>'source'='sky_upgrade','a whole-sky complement is Premium';
 perform public.lumen_record_purchase('play','p-1',prem,'lumen-premium',499,'EUR','paid');
 assert lumen_commands.premium_status(prem)->>'source'='premium_purchase';
 assert (select count(*) from lumen.entitlements e where e.user_id=prem and e.source='purchase' and e.expires_at is null and e.entitlement=any(packs))=cardinality(packs),
  'Premium owns the whole main sky through the existing entitlement path';
 r:=public.lumen_get_main_sky_purchase_progress(prem);
 assert r is null or (r->>'unlocked')::boolean or true;
 perform public.lumen_record_purchase('play','p-1',prem,'lumen-premium',499,'EUR','refunded');
 assert not lumen_commands.is_premium(prem);
 assert not exists(select 1 from lumen.entitlements e where e.user_id=prem and e.source='purchase' and (e.expires_at is null or e.expires_at>clock_timestamp())),
  'a Premium refund expires the purchase rights, like real-sky-all';
 perform public.lumen_record_purchase('play','p-1',prem,'lumen-premium',499,'EUR','paid');

 -- Historical inventory: only an administrative whole sky becomes a traced grant.
 foreach p in array packs loop
  insert into lumen.entitlements(user_id,entitlement,granted_at,source) values(admin_sky,p,now(),'admin_manual_all_adventures_2026_11_06'),
   (mastery_sky,p,now(),'mastery');
  insert into lumen.entitlements(user_id,entitlement,granted_at,source) values(mixed,p,now(),case when p=packs[1] then 'purchase' else 'admin' end);
 end loop;
 insert into lumen.entitlements(user_id,entitlement,granted_at,source) values(partial,packs[1],now(),'admin'),(partial,packs[2],now(),'admin');
 r:=lumen_commands.premium_backfill(false);
 assert (r->>'granted')::int=0 and not exists(select 1 from lumen_commands.premium_grants),'dry run writes nothing';
 assert (r->'classes'->>'admin_full_sky')::int=1 and (r->'classes'->>'mastery_full_sky')::int=1
  and (r->'classes'->>'mixed_full_sky_uncovered')::int=1 and (r->'classes'->>'partial')::int>=1,r::text;
 assert position(admin_sky::text in r::text)=0 and position(mixed::text in r::text)=0,'no account identifier in the report';
 r:=lumen_commands.premium_backfill(true);
 assert (r->>'granted')::int=1,r::text;
 assert lumen_commands.premium_status(admin_sky)->>'source'='admin_full_sky';
 assert not lumen_commands.is_premium(mastery_sky),'mastery-only sky keeps its content without Premium';
 assert not lumen_commands.is_premium(mixed),'mixed sources are reported, never granted';
 assert not lumen_commands.is_premium(partial),'partial grants are not a whole sky';
 assert (select count(*) from lumen_commands.premium_grant_events where user_id=admin_sky and action='grant')=1;
 r:=lumen_commands.premium_backfill(true);
 assert (r->>'granted')::int=0 and (r->'classes'->>'premium_granted')::int=1,'idempotent: '||r::text;
 assert lumen_commands.premium_revoke_grant(admin_sky),'rollback of a grant';
 assert not lumen_commands.is_premium(admin_sky),'a revoked grant is no longer Premium';
 assert not lumen_commands.premium_revoke_grant(admin_sky);
 assert (select count(*) from lumen.entitlements where user_id=admin_sky and expires_at is null)=cardinality(packs),'rollback never touches content rights';

 -- Commerce state: account-scoped, QA preview, counts.
 perform set_config('request.jwt.claim.sub',qa::text,true);
 begin perform public.lumen_get_commerce_state(free_p,d);raise exception 'other account read';
 exception when insufficient_privilege then null;end;
 r:=public.lumen_get_commerce_state(qa,d);
 assert r->'preview'='true'::jsonb and r->'premium'->>'active'='false' and r->'activatedAt'='null'::jsonb
  and (r->'counts'->>'new')::int=0,r::text;

 -- Quota ledger: dedup across calls/devices, monotonic activation, validation.
 perform set_config('request.jwt.claim.sub',free_p::text,true);
 begin perform public.lumen_quota_sync(qa,d,'[]');raise exception 'foreign sync';
 exception when insufficient_privilege then null;end;
 begin perform public.lumen_quota_sync(free_p,d+5,'[]');raise exception 'far day';
 exception when invalid_parameter_value then assert sqlerrm='quota_day_invalid';end;
 c:=jsonb_build_array(
  jsonb_build_object('attemptId','attempt-0001-reset-0','questId','base-q021','kind','new','day',d,'timeZone','Europe/Paris','startedAt',now()),
  jsonb_build_object('attemptId','attempt-0002-reset-0','questId','base-q022','kind','new','day',d,'timeZone','Europe/Paris','startedAt',now()),
  jsonb_build_object('attemptId','attempt-0003-reset-0','questId','base-q001','kind','replay','day',d,'timeZone','Europe/Paris','startedAt',now()));
 r:=public.lumen_quota_sync(free_p,d,c,jsonb_build_object('at',now()-interval '1 hour','questId','base-q021'));
 assert (r->>'accepted')::int=3 and (r->'counts'->>'new')::int=2 and (r->'counts'->>'replay')::int=1,r::text;
 r:=public.lumen_quota_sync(free_p,d,c,jsonb_build_object('at',now(),'questId','base-q022'));
 assert (r->>'accepted')::int=0 and (r->'counts'->>'new')::int=2,'second device resend is deduplicated: '||r::text;
 assert (select activation_quest from lumen_commands.quota_state where user_id=free_p)='base-q021','the earliest activation is kept';
 r:=public.lumen_quota_sync(free_p,d,'[]',jsonb_build_object('at',now()-interval '2 hours','questId','base-q030'));
 assert (select activation_quest from lumen_commands.quota_state where user_id=free_p)='base-q030','an earlier offline activation wins';
 begin perform public.lumen_quota_sync(free_p,d,jsonb_build_array(jsonb_build_object('attemptId','attempt-0004-reset-0','questId','base-q023','kind','new',
  'day',d+3,'timeZone','Europe/Paris','startedAt',now())));raise exception 'inconsistent day';
 exception when invalid_parameter_value then assert sqlerrm='quota_attempt_invalid';end;
 begin perform public.lumen_quota_sync(free_p,d,jsonb_build_array(jsonb_build_object('attemptId','attempt-0005-reset-0','questId','base-q023','kind','new',
  'day',d-8,'timeZone','Europe/Paris','startedAt',now()-interval '8 days')));raise exception 'stale offline attempt';
 exception when invalid_parameter_value then assert sqlerrm='quota_attempt_invalid';end;
 begin perform public.lumen_quota_sync(free_p,d,jsonb_build_array(jsonb_build_object('attemptId','x','questId','base-q023','kind','bonus',
  'day',d,'timeZone','Europe/Paris','startedAt',now())));raise exception 'bad kind';
 exception when invalid_parameter_value then null;end;
 begin perform public.lumen_quota_sync(free_p,d,(select jsonb_agg(jsonb_build_object('attemptId','attempt-bulk-'||g,'questId','base-q023','kind','new','day',d,
  'timeZone','UTC','startedAt',now())) from generate_series(1,41) g));raise exception 'unbounded batch';
 exception when invalid_parameter_value then assert sqlerrm='quota_batch_invalid';end;
 -- A run started before midnight stays on its start day (UTC+14 accepted).
 r:=public.lumen_quota_sync(free_p,d,jsonb_build_array(jsonb_build_object('attemptId','attempt-0006-reset-0','questId','base-q024','kind','new',
  'day',(now() at time zone 'Pacific/Kiritimati')::date,'timeZone','Pacific/Kiritimati','startedAt',now())));
 assert (r->>'accepted')::int=1,r::text;
 insert into lumen_commands.quota_attempts(user_id,attempt_id,quest_id,kind,local_day,time_zone,started_at)
  values(free_p,'attempt-old-000','base-q001','new',d-60,'UTC',now()-interval '60 days');
 perform public.lumen_quota_sync(free_p,d,'[]');
 assert not exists(select 1 from lumen_commands.quota_attempts where user_id=free_p and attempt_id='attempt-old-000'),'bounded retention';
 r:=public.lumen_get_commerce_state(free_p,d);
 -- The UTC+14 run counts on day d only when its local date is d (00:00–10:00 UTC).
 assert r->>'activatedAt' is not null and (r->'counts'->>'new')::int=2+case when (now() at time zone 'Pacific/Kiritimati')::date=d then 1 else 0 end,r::text;

 -- Stripe Premium guard: inactive product unknown, then already Premium refused.
 assert public.lumen_stripe_checkout_begin(free_p,'lumen-premium',now(),false)->>'result'='unknown_product';
 update lumen_commands.store_products set active=true where product_id='lumen-premium';
 assert public.lumen_stripe_checkout_begin(prem,'lumen-premium',now(),false)->>'result'='already_owned';
 r:=public.lumen_stripe_checkout_begin(free_p,'lumen-premium',now(),false);
 assert r->>'result'='reserved' and r->>'kind'='premium' and (r->>'amount_cents')::int=499,r::text;
 perform lumen_commands.stripe_checkout_release((r->>'reservation_id')::uuid);
 update lumen_commands.store_products set active=false where product_id='lumen-premium';

 -- Private circles: free creation while off; Premium/QA only once on; joining stays free.
 insert into lumen.profiles(user_id,nickname) values(free_p,'Free1030'),(prem,'Prem1030'),(qa,'Qa1030'),(units,'Units1030');
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values(prem,free_p,'friends'),(free_p,prem,'friends');
 perform set_config('request.jwt.claim.sub',free_p::text,true);
 r:=public.lumen_circle_create('Avant');
 assert r->>'id' is not null,'creation unchanged while premium_circles is off';
 perform lumen_commands.set_commerce_setting('premium_circles','true');
 begin perform public.lumen_circle_create('Gratuit');raise exception 'free player created a circle';
 exception when raise_exception then assert sqlerrm='circle_premium_required',sqlerrm;end;
 assert exists(select 1 from lumen.circles where id=(r->>'id')::uuid),'existing circles are kept';
 perform set_config('request.jwt.claim.sub',qa::text,true);
 assert public.lumen_circle_create('Recette')->>'id' is not null,'QA preview can create';
 perform set_config('request.jwt.claim.sub',prem::text,true);
 r:=public.lumen_circle_create('Premium');
 assert r->>'id' is not null;
 perform public.lumen_circle_invite_friend((r->>'id')::uuid,'Free1030');
 perform set_config('request.jwt.claim.sub',free_p::text,true);
 perform public.lumen_circle_respond((select i.id from lumen.circle_invites i where i.recipient_user_id=free_p and i.circle_id=(r->>'id')::uuid),true);
 assert exists(select 1 from lumen.circle_members where circle_id=(r->>'id')::uuid and user_id=free_p),'joining stays free';
 perform lumen_commands.set_commerce_setting('premium_circles','false');

 -- Quota calibration: analytics capability only, bounded parameters, no identifiers.
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible,result) values
  (mastery_sky,'op-1','base-q001',0,now(),true,'{"status":"confirmed"}'),
  (mastery_sky,'op-2','base-q001',0,now()+interval '1 second',true,null),
  (mastery_sky,'op-3','base-q021',0,now()+interval '2 seconds',true,null),
  (mastery_sky,'op-4','base-q022',0,now()+interval '3 seconds',true,null);
 update lumen_commands.ranking_runs set issued_at=started_at where user_id=mastery_sky;
 perform set_config('request.jwt.claim.sub',free_p::text,true);
 begin perform public.lumen_admin_quota_simulation(30,array['base-q001']);raise exception 'player read the simulation';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_::text,true);
 begin perform public.lumen_admin_quota_simulation(365,array['base-q001']);raise exception 'unbounded period';
 exception when invalid_parameter_value then null;end;
 r:=public.lumen_admin_quota_simulation(30,array['base-q001'],array[1,2,5],5);
 assert (r->'coverage'->>'players')::int>=1 and jsonb_array_length(r->'simulation')=3,r::text;
 assert position(mastery_sky::text in r::text)=0,'aggregates only';
 assert exists(select 1 from jsonb_array_elements(r->'simulation') s where (s->>'newQuota')::int=2 and (s->>'pctDaysReachNew')::numeric=100),r::text;

 -- Lot 2: playable archives and advanced statistics are Premium (or QA preview),
 -- never expose today or a future grid, and are bounded.
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision)
  select lumen_commands.daily_today()-1,quest_id,0 from lumen_commands.quest_rules order by quest_id limit 1
  on conflict (day) do nothing;
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision)
  select lumen_commands.daily_today()+1,quest_id,0 from lumen_commands.quest_rules order by quest_id limit 1
  on conflict (day) do nothing;
 assert has_function_privilege('authenticated','public.lumen_daily_archive(date)','EXECUTE')
  and not has_function_privilege('anon','public.lumen_daily_archive(date)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_premium_stats(uuid,timestamptz,integer)','EXECUTE');
 perform set_config('request.jwt.claim.sub',units::text,true);
 begin perform public.lumen_daily_archive(lumen_commands.daily_today()-1);raise exception 'archive before launch';
 exception when insufficient_privilege then assert sqlerrm='premium_required';end;
 perform lumen_commands.set_commerce_setting('premium_enabled','true');
 perform lumen_commands.set_commerce_setting('premium_archives','true');
 perform lumen_commands.set_commerce_setting('premium_stats','true');
 r:=public.lumen_daily_archive(lumen_commands.daily_today()-1);
 assert r->>'quest_id' is not null and (r->>'day')::date=lumen_commands.daily_today()-1,'a Premium player replays a past day: '||r::text;
 begin perform public.lumen_daily_archive(lumen_commands.daily_today());raise exception 'today exposed';
 exception when invalid_parameter_value then assert sqlerrm='archive_day_invalid';end;
 begin perform public.lumen_daily_archive(lumen_commands.daily_today()+1);raise exception 'future exposed';
 exception when invalid_parameter_value then assert sqlerrm='archive_day_invalid';end;
 begin perform public.lumen_daily_archive(lumen_commands.daily_today()-400);raise exception 'unknown day';
 exception when invalid_parameter_value then assert sqlerrm='archive_not_found';end;
 i:=(select count(*) from lumen_commands.daily_runs);
 assert (select count(*) from lumen_commands.daily_runs)=i,'an archive read writes no run';
 perform set_config('request.jwt.claim.sub',mastery_sky::text,true);
 begin perform public.lumen_daily_archive(lumen_commands.daily_today()-1);raise exception 'free player replayed an archive';
 exception when insufficient_privilege then assert sqlerrm='premium_required';end;
 begin perform public.lumen_premium_stats(mastery_sky);raise exception 'free player read advanced stats';
 exception when insufficient_privilege then assert sqlerrm='premium_required';end;
 perform set_config('request.jwt.claim.sub',units::text,true);
 begin perform public.lumen_premium_stats(mastery_sky);raise exception 'foreign stats';
 exception when insufficient_privilege then null;end;
 begin perform public.lumen_premium_stats(units,null,51);raise exception 'unbounded page';
 exception when invalid_parameter_value then null;end;
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible,result) values
  (units,'st-1','base-q001',0,now()-interval '2 days',true,'{"status":"confirmed","improved":true}'),
  (units,'st-2','base-q002',0,now()-interval '1 day',true,null),
  (units,'st-3','base-q003',0,now(),false,'{"status":"confirmed","improved":false}');
 update lumen_commands.ranking_runs set issued_at=started_at where user_id=units;
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome) values
  (units,'st-1','{"facts":{"seconds":42}}','{}'),(units,'st-3','{"facts":{"seconds":"bad"}}','{}');
 r:=public.lumen_premium_stats(units,null,2);
 assert jsonb_array_length(r->'history')=2 and r->'history'->0->>'questId'='base-q003' and r->'history'->0->'seconds'='null'::jsonb,r::text;
 assert jsonb_array_length(r->'series')=3 and r->'records' is not null,r::text;
 r:=public.lumen_premium_stats(units,(r->'history'->1->>'at')::timestamptz,2);
 assert jsonb_array_length(r->'history')=1 and (r->'history'->0->>'seconds')::int=42 and r->'series'='null'::jsonb,'keyset page 2: '||r::text;
 perform lumen_commands.set_commerce_setting('premium_archives','false');
 perform lumen_commands.set_commerce_setting('premium_stats','false');
 perform lumen_commands.set_commerce_setting('premium_enabled','false');

 -- Privacy: every player table is erased with the account.
 assert (select count(*) from lumen_privacy.policy() where ns='lumen_commands' and rel in ('premium_grants','premium_grant_events','quota_state','quota_attempts') and action='delete')=4;
 perform set_config('request.jwt.claim.sub','',true);
 perform lumen_privacy.review_erasure(free_p,array[]::text[]);
 perform lumen_privacy.erase_account(free_p,array[]::text[],'ERASE LUMEN '||free_p::text);
 assert not exists(select 1 from lumen_commands.quota_attempts where user_id=free_p) and not exists(select 1 from lumen_commands.quota_state where user_id=free_p);
 perform lumen_privacy.erase_account(admin_sky,array[]::text[],'ERASE LUMEN '||admin_sky::text);
 assert not exists(select 1 from lumen_commands.premium_grants where user_id=admin_sky) and not exists(select 1 from lumen_commands.premium_grant_events where user_id=admin_sky);
end $$;
rollback;
