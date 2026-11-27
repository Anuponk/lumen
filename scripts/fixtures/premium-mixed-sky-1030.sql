-- Disposable PostgreSQL only; synthetic accounts, rolled back. #1030 owner decision:
-- admin + purchase whole sky becomes Premium at backfill; mastery stays excluded.
begin;
do $$
declare
 mixed constant uuid:='00000000-0000-4000-8000-000001030101';
 with_mastery constant uuid:='00000000-0000-4000-8000-000001030102';
 review constant uuid:='00000000-0000-4000-8000-000001030103';
 packs text[]; p text; r jsonb;
begin
 select array_agg(pack_id order by pack_id) into packs from lumen_commands.adventure_packs where access='locked' and pack_id ~ '^real-adventure-0[2-9]$';
 insert into auth.users(id) values(mixed),(with_mastery),(review);
 foreach p in array packs loop
  insert into lumen.entitlements(user_id,entitlement,granted_at,source) values
   (mixed,p,now(),case when p=packs[1] then 'purchase' when p=packs[2] then 'manual' else 'admin' end),
   (with_mastery,p,now(),case when p=packs[1] then 'mastery' else 'admin' end),
   (review,p,now(),'admin_google_play_review_2026_11_18');
 end loop;
 r:=lumen_commands.premium_backfill(false);
 assert (r->>'granted')::int=0 and not exists(select 1 from lumen_commands.premium_grants where user_id in (mixed,with_mastery,review)),'dry run';
 r:=lumen_commands.premium_backfill(true);
 assert lumen_commands.premium_status(mixed)->>'source'='admin_mixed_full_sky','admin + purchase whole sky: '||r::text;
 assert lumen_commands.premium_status(review)->>'source'='admin_full_sky','Play review account';
 assert not lumen_commands.is_premium(with_mastery),'a sky including mastery stays without automatic Premium';
 assert (select source from lumen_commands.premium_grant_events where user_id=mixed and action='grant')='admin_mixed_full_sky';
 r:=lumen_commands.premium_backfill(true);
 assert (r->>'granted')::int=0,'idempotent';
 begin insert into lumen_commands.premium_grants(user_id,source) values(with_mastery,'mastery');raise exception 'unknown source accepted';
 exception when check_violation then null;end;
end $$;
rollback;
