-- Disposable PostgreSQL only; synthetic accounts. #728 purchases, €5 cap, refunds and
-- mastery unlocks. Runs after the #724 step (entitlements aligned with production).
insert into auth.users(id) values('00000000-0000-0000-0000-000000072801'),('00000000-0000-0000-0000-000000072802'),
 ('00000000-0000-0000-0000-000000072803');

-- Catalogue seed sanity: generated from the client catalogue.
do $$begin
 assert (select count(*) from lumen_commands.adventure_packs where access='included')=1,'one included Adventure';
 assert (select count(*) from lumen_commands.store_products where kind='adventure')=(select count(*) from lumen_commands.adventure_packs where access='locked'),'one product per locked Adventure';
 assert (select price_cents from lumen_commands.store_products where kind='sky')=(select cap_cents from lumen_commands.store_settings),'cap equals the whole-sky price';
 assert not exists(select 1 from lumen_commands.adventure_packs a where not exists(select 1 from lumen_commands.quest_packs q where q.pack_id=a.pack_id)),'every Adventure has quests';
end $$;

-- Clients can neither record purchases nor read the ledger.
do $$begin
 assert not has_function_privilege('authenticated','lumen_commands.record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE'),'players cannot record purchases';
 assert not has_function_privilege('anon','lumen_commands.record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE');
 assert has_function_privilege('service_role','lumen_commands.record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE'),'trusted verifiers can';
 assert not has_table_privilege('authenticated','lumen_commands.purchases','SELECT'),'ledger is private';
 assert not has_table_privilege('authenticated','lumen_commands.purchase_events','SELECT');
 assert not has_function_privilege('anon','public.lumen_claim_mastery_unlock(uuid,text)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.adventure_mastery(uuid,text)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.sync_purchase_entitlements(uuid)','EXECUTE');
end $$;

-- Purchases, idempotency, validation, €5 cap, refunds and disputes.
insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source)
 values('00000000-0000-0000-0000-000000072802','real-adventure-09',now(),null,'admin');
do $$declare p uuid:='00000000-0000-0000-0000-000000072802';r jsonb;bad text;
 owned text[];
begin
 r:=lumen_commands.record_purchase('play','gp-1',p,'real-adventure-03',100,'EUR','paid');
 assert (r->>'changed')::boolean and r->'adventures' ? 'real-adventure-03','single purchase grants its Adventure';
 assert (select source from lumen.entitlements where user_id=p and entitlement='real-adventure-03')='purchase';
 r:=lumen_commands.record_purchase('play','gp-1',p,'real-adventure-03',100,'EUR','paid');
 assert not (r->>'changed')::boolean,'replayed purchase is idempotent';
 assert (select count(*) from lumen_commands.purchases where user_id=p)=1 and (select count(*) from lumen_commands.purchase_events where user_id=p)=1;
 begin perform lumen_commands.record_purchase('play','gp-1',p,'real-adventure-04',100,'EUR','paid');
  raise exception 'identity conflict accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','gp-1','00000000-0000-0000-0000-000000072803','real-adventure-03',100,'EUR','paid');
  raise exception 'purchase moved to another account';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('paypal','x',p,'real-adventure-03',100,'EUR','paid');raise exception 'bad provider';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','x',p,'base-real-sky',100,'EUR','paid');raise exception 'free Adventure sold';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','x',p,'real-adventure-03',100,'EUR','free');raise exception 'bad status';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','x',p,'real-adventure-03',-1,'EUR','paid');raise exception 'negative amount';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','x',p,'real-adventure-03',100,'eur','paid');raise exception 'bad currency';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','x',gen_random_uuid(),'real-adventure-03',100,'EUR','paid');raise exception 'unknown player';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.record_purchase('play','',p,'real-adventure-03',100,'EUR','paid');raise exception 'empty reference';exception when invalid_parameter_value then null;end;

 perform lumen_commands.record_purchase('play','gp-4',p,'real-adventure-04',100,'EUR','paid');
 perform lumen_commands.record_purchase('play','gp-5',p,'real-adventure-05',100,'EUR','paid');
 r:=lumen_commands.record_purchase('play','gp-6',p,'real-adventure-06',100,'EUR','paid');
 assert not (r->'adventures' ? 'real-adventure-07'),'€4 does not reach the cap';
 r:=lumen_commands.record_purchase('play','gp-7',p,'real-adventure-07',100,'EUR','paid');
 select array_agg(pack_id order by pack_id) into owned from lumen_commands.adventure_packs where access='locked';
 assert (select bool_and(r->'adventures' ? x) from unnest(owned) x),'€5 of single purchases unlock every locked Adventure';
 assert (select source from lumen.entitlements where user_id=p and entitlement='real-adventure-08')='purchase','cap rights are purchase rights';

 r:=lumen_commands.record_purchase('play','gp-1',p,'real-adventure-03',100,'EUR','refunded');
 assert (r->>'changed')::boolean and r->>'status'='refunded';
 assert not (r->'adventures' ? 'real-adventure-03'),'refund withdraws the refunded Adventure';
 assert not (r->'adventures' ? 'real-adventure-08') and not (r->'adventures' ? 'real-adventure-02'),'below the cap, cap rights are withdrawn';
 assert r->'adventures' ? 'real-adventure-04' and r->'adventures' ? 'real-adventure-07','other paid Adventures stay owned';
 assert r->'adventures' ? 'real-adventure-09','an administrator grant is never expired by purchases';
 assert exists(select 1 from lumen.entitlements where user_id=p and entitlement='real-adventure-03' and expires_at is not null),'withdrawal expires the row, never deletes it';
 assert (select count(*) from lumen_commands.purchase_events where user_id=p)=6,'status changes are audited';

 r:=lumen_commands.record_purchase('play','gp-4',p,'real-adventure-04',100,'EUR','disputed');
 assert not (r->'adventures' ? 'real-adventure-04'),'a disputed payment is not paid';
 r:=lumen_commands.record_purchase('play','gp-4',p,'real-adventure-04',100,'EUR','paid');
 assert r->'adventures' ? 'real-adventure-04','a won dispute restores the right';

 r:=lumen_commands.record_purchase('stripe','cs-sky',p,'real-sky-all',500,'EUR','paid');
 assert (select bool_and(r->'adventures' ? x) from unnest(owned) x),'the whole-sky product unlocks everything';
 r:=lumen_commands.record_purchase('stripe','cs-sky',p,'real-sky-all',500,'EUR','refunded');
 assert not (r->'adventures' ? 'real-adventure-02'),'refunding the whole sky withdraws what single purchases do not cover';

 r:=lumen_commands.record_purchase('play','gp-usd',p,'real-adventure-02',99,'USD','paid');
 assert r->'adventures' ? 'real-adventure-02','a non-EUR purchase grants its product';
 assert not (r->'adventures' ? 'real-adventure-08'),'only EUR payments count towards the EUR cap';
end $$;

-- Mastery: the server recomputes it from its own victory projections.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000072801';
set role authenticated;
do $$declare r jsonb;begin
 begin perform public.lumen_claim_mastery_unlock('00000000-0000-0000-0000-000000072802','real-adventure-02');
  raise exception 'account mismatch accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_claim_mastery_unlock(auth.uid(),'base-real-sky');raise exception 'included Adventure claimed';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_claim_mastery_unlock(auth.uid(),'unknown-pack');raise exception 'unknown Adventure claimed';exception when invalid_parameter_value then null;end;
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-02');
 assert r->>'previous'='base-real-sky' and not (r->>'mastered')::boolean and not (r->>'changed')::boolean,'no progress, no unlock';
 assert (r->'mastery'->>'completed')::integer=0 and (r->'mastery'->>'possible')::integer>0;
end $$;
reset role;

-- Build a 100% mastered first Adventure (legacy and canonical quests), minus one badge.
do $$declare p uuid:='00000000-0000-0000-0000-000000072801';solved jsonb;perf jsonb;all_badges jsonb;begin
 all_badges:=(select jsonb_object_agg(k,true) from unnest((select badge_keys from lumen_commands.store_settings)) k);
 select coalesce(jsonb_object_agg(q.legacy_index::text,1),'{}'),
  coalesce(jsonb_object_agg(q.legacy_index::text,jsonb_build_object('version',3,'badges',all_badges)),'{}')
  into solved,perf from lumen_commands.quest_packs q where q.pack_id='base-real-sky' and q.legacy_index is not null;
 insert into lumen_commands.legacy_authority(user_id,revision,projection)
  values(p,1,jsonb_build_object('solved',solved,'performances',perf,'stars','{}'::jsonb,'noHint','{}'::jsonb,'challenges','{}'::jsonb,'autonomousWins',0))
  on conflict(user_id) do update set projection=excluded.projection;
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection)
  select p,q.quest_id,jsonb_build_object('solved',true,'badges',all_badges) from lumen_commands.quest_packs q
  where q.pack_id='base-real-sky' and q.legacy_index is null
  on conflict(user_id,quest_id) do update set projection=excluded.projection;
 update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges,speed}','false'::jsonb)
  where user_id=p and quest_id=(select quest_id from lumen_commands.quest_packs where pack_id='base-real-sky' and legacy_index is null order by quest_id limit 1);
end $$;
set role authenticated;
do $$declare r jsonb;begin
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-02');
 assert not (r->>'mastered')::boolean and (r->'mastery'->>'completed')=(r->'mastery'->>'quests'),'every quest done';
 assert (r->'mastery'->>'earned')::integer=(r->'mastery'->>'possible')::integer-1,'one badge missing blocks the unlock';
end $$;
reset role;
-- A legacy performance record older than version 2 holds no badge.
do $$declare p uuid:='00000000-0000-0000-0000-000000072801';idx text;begin
 update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges,speed}','true'::jsonb) where user_id=p;
 select (select legacy_index::text from lumen_commands.quest_packs where pack_id='base-real-sky' and legacy_index is not null order by legacy_index limit 1) into idx;
 update lumen_commands.legacy_authority set projection=jsonb_set(projection,array['performances',idx,'version'],'1'::jsonb) where user_id=p;
end $$;
set role authenticated;
do $$declare r jsonb;begin
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-02');
 assert not (r->>'mastered')::boolean,'pre-version-2 legacy badges do not count';
end $$;
reset role;
do $$declare p uuid:='00000000-0000-0000-0000-000000072801';idx text;begin
 select (select legacy_index::text from lumen_commands.quest_packs where pack_id='base-real-sky' and legacy_index is not null order by legacy_index limit 1) into idx;
 update lumen_commands.legacy_authority set projection=jsonb_set(projection,array['performances',idx,'version'],'3'::jsonb) where user_id=p;
end $$;
set role authenticated;
do $$declare r jsonb;begin
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-02');
 assert (r->>'mastered')::boolean and (r->>'changed')::boolean,'100% mastery unlocks the next Adventure';
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-02');
 assert (r->>'mastered')::boolean and not (r->>'changed')::boolean,'claim retry is idempotent';
 r:=public.lumen_claim_mastery_unlock(auth.uid(),'real-adventure-03');
 assert r->>'previous'='real-adventure-02' and not (r->>'mastered')::boolean,'only the next Adventure, never the whole sky';
end $$;
reset role;
do $$declare p uuid:='00000000-0000-0000-0000-000000072801';begin
 assert (select source from lumen.entitlements where user_id=p and entitlement='real-adventure-02')='mastery';
 assert (select count(*) from lumen_commands.adventure_access_audit where user_id=p and actor=p and adventure='real-adventure-02')=1,'mastery unlock is audited once';
 assert not exists(select 1 from lumen.entitlements where user_id=p and entitlement='real-adventure-03'),'nothing else unlocked';
 -- Purchases never expire a mastery right, even after a refund.
 perform lumen_commands.record_purchase('play','gp-m',p,'real-adventure-02',100,'EUR','paid');
 perform lumen_commands.record_purchase('play','gp-m',p,'real-adventure-02',100,'EUR','refunded');
 assert exists(select 1 from lumen.entitlements where user_id=p and entitlement='real-adventure-02' and expires_at is null and source='mastery'),'mastery right survives a refund';
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='purchases' and action='delete'),'purchases are in the erasure policy';
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='purchase_events' and action='delete');
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='quest_packs' and action='retain-rule');
end $$;
