-- Disposable PostgreSQL only. Never run this fixture against player data.
do $case$
declare u uuid:=gen_random_uuid(); p jsonb; r jsonb; f jsonb; i integer; q text;
begin
 insert into auth.users values(u);
 perform set_config('request.jwt.claim.sub',u::text,true);
 p:='{"solved":{"0":1},"badges":{"first":1},"stars":{},"performances":{"0":{"version":3,"badges":{"speed":true},"bestTime":40}},"shards":2,"xp":15,"skyScore":1,"historyBackup":{"0":1}}';
 assert public.lumen_initialize_profile(p,u)=p,'Guest profile must survive atomic account initialization';
 assert public.lumen_initialize_profile('{"solved":{},"badges":{},"shards":3,"xp":0}',u)=p,'Retry cannot reset progress';
 perform public.lumen_commit_wallet_command('wallet-establish-v1',u,'{"kind":"establish"}');
 assert public.lumen_restore_profile(u)->>'shards'='2','Wallet establishes the actual guest net balance';
 assert public.lumen_restore_profile(u)->'performances'->'0'->'badges'->>'speed'='true';
 f:=jsonb_build_object('seconds',40,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',false,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',now()::text);
 select quest_id into q from lumen_commands.legacy_rules where legacy_index=0;
 r:=public.lumen_commit_legacy_command('guest-replay',u,q,f);
 assert r->'profile'->>'xp'='15','An imported guest win must not grant base XP again';
 assert r->'profile'->'performances'->'0'->'badges' @> '{"speed":true,"autonomy":true,"noError":true,"mastery":true}';
 p:=r->'profile';
 perform public.lumen_commit_legacy_command('guest-replay',u,q,f);
 assert public.lumen_restore_profile(u)=p,'Same operation cannot grant again';
 for i in 0..3 loop
  u:=gen_random_uuid();insert into auth.users values(u);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.lumen_initialize_profile('{"solved":{},"badges":{},"stars":{},"performances":{},"noHint":{},"challenges":{},"xp":0,"shards":3}',u);
  select quest_id into q from lumen_commands.legacy_rules where legacy_index=i;
  r:=public.lumen_commit_legacy_command('first',u,q,f);
  assert r->'profile'->'performances'->i::text->'badges' @> '{"speed":true,"autonomy":true,"noError":true,"mastery":true}','Every early quest awards all eligible badges';
 end loop;
 begin
  perform public.lumen_initialize_profile('{"solved":{},"badges":{}}',gen_random_uuid());
  raise exception 'Cross-account initialization accepted';
 exception when insufficient_privilege then null;end;
end $case$;
