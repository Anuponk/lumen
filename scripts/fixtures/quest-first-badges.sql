-- Disposable PostgreSQL only. A future stable quest may occupy any early ordinal.
do $case$
declare q text; original jsonb; u uuid; n integer; facts jsonb; result jsonb; saved jsonb;
begin
 select quest_id,rules into q,original from lumen_commands.quest_rules where legacy_index is null limit 1;
 facts:=jsonb_build_object('seconds',45,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,
  'hintUsed',false,'challengeFailed',false,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',now()::text);
 for n in 1..6 loop
  update lumen_commands.quest_rules set rules=jsonb_set(original,'{ordinal}',to_jsonb(n)) where quest_id=q;
  u:=gen_random_uuid();insert into auth.users values(u);
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"stars":{},"performances":{},"canonicalQuestState":{},"challenges":{},"xp":0,"shards":3}');
  result:=public.lumen_commit_quest_command('early-stable-quest',u,q,facts);
  assert result->'profile'->'canonicalQuestState'->q->'badges' @> '{"speed":true,"autonomy":true,"noError":true,"mastery":true}',
   'Early stable quests must retain the four-badge contract of #529';
  saved:=result->'profile';
  assert public.lumen_commit_quest_command('early-stable-quest',u,q,facts)->'profile'=saved,'Retry cannot grant again';
 end loop;
 update lumen_commands.quest_rules set rules=original where quest_id=q;
end $case$;
