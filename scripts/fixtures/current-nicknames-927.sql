-- #927: renamed accounts show their current nickname in every challenge view;
-- guests keep their stored name; nothing else changes. Real migrated schema;
-- disposable fixture (invented identities), rolled back.
begin;
do $$
declare
 loutre constant uuid:='00000000-0000-4000-8000-000000927001';
 blaireau constant uuid:='00000000-0000-4000-8000-000000927002';
 nameless constant uuid:='00000000-0000-4000-8000-000000927003';
 erased constant uuid:='00000000-0000-4000-8000-000000927004';
 quest_number integer;link uuid;guest_link uuid;gone_link uuid;x jsonb;listed jsonb;item jsonb;before jsonb;after jsonb;txt text;
begin
 insert into auth.users(id) values(loutre),(blaireau),(nameless),(erased);
 select legacy_index+1 into quest_number from lumen_commands.quest_rules where legacy_index is not null and grid_revision=0 order by legacy_index limit 1;
 perform set_config('request.jwt.claim.sub',loutre::text,true);perform public.lumen_set_nickname('Loutre927');
 perform set_config('request.jwt.claim.sub',blaireau::text,true);perform public.lumen_set_nickname('Blaireau927');
 perform set_config('request.jwt.claim.sub',erased::text,true);perform public.lumen_set_nickname('Efface927');

 -- Loutre challenges; Blaireau (account), a guest and a nickname-less account play it.
 perform set_config('request.jwt.claim.sub',loutre::text,true);
 select challenge_id into link from public.lumen_create_qualifying_challenge(null,'Loutre927',quest_number,null,0,80,true,false,false,false,true,true);
 perform set_config('request.jwt.claim.sub',blaireau::text,true);
 perform public.lumen_start_social_challenge(link,null,'Blaireau927',false);
 perform public.lumen_finish_social_challenge(link,null,'Blaireau927','completed',75,true,false,false,false);
 perform set_config('request.jwt.claim.sub','',true);
 perform public.lumen_start_social_challenge(link,'guest-927-player','Blaireau927',false); -- same name, not the account
 perform public.lumen_finish_social_challenge(link,'guest-927-player','Blaireau927','completed',90,false,false,false,true);
 perform set_config('request.jwt.claim.sub',nameless::text,true);
 perform public.lumen_start_social_challenge(link,null,'Sans927',false);
 -- A guest sender and an account sender later erased.
 perform set_config('request.jwt.claim.sub','',true);
 select challenge_id into guest_link from public.lumen_create_qualifying_challenge('guest-927-sender','Invite927',quest_number,null,0,70,true,false,false,false,true,true);
 perform set_config('request.jwt.claim.sub',erased::text,true);
 select challenge_id into gone_link from public.lumen_create_qualifying_challenge(null,'Efface927',quest_number,null,0,65,true,false,false,false,true,true);

 perform set_config('request.jwt.claim.sub',loutre::text,true);
 before:=public.lumen_list_quest_challenges_v2(null,'Loutre927');

 -- Both accounts rename (lumen_set_nickname is the only rename path).
 perform public.lumen_set_nickname('Orion927');
 perform set_config('request.jwt.claim.sub',blaireau::text,true);perform public.lumen_set_nickname('Castor927');

 -- Old link opened by the participant: sender and own name are current.
 x:=public.lumen_get_quest_challenge_v2(link,null,'Castor927');
 assert x->>'sender_display_name'='Orion927','old link shows the sender''s current nickname';
 assert x->>'participant_display_name'='Castor927','the caller''s own result shows their current nickname';
 assert (x->>'participant_duration_seconds')::int=75 and x->>'participant_status'='completed','result unchanged';
 -- The guest who typed the same name keeps the stored name; never merged with the account.
 perform set_config('request.jwt.claim.sub','',true);
 x:=public.lumen_get_quest_challenge_v2(link,'guest-927-player','Blaireau927');
 assert x->>'participant_display_name'='Blaireau927' and (x->>'participant_duration_seconds')::int=90,'guest keeps its snapshot';
 assert x->>'sender_display_name'='Orion927','guests also see the sender''s current nickname';
 -- A guest sender keeps the stored name.
 assert public.lumen_get_quest_challenge_v2(guest_link,'guest-927-other','Autre927')->>'sender_display_name'='Invite927','guest sender keeps its snapshot';

 -- Sender's history: participants resolved, everything else identical.
 perform set_config('request.jwt.claim.sub',loutre::text,true);
 after:=public.lumen_list_quest_challenges_v2(null,'Orion927');
 select i into item from jsonb_array_elements(after) i where (i->>'challenge_id')::uuid=link;
 assert (select count(*) from jsonb_array_elements(item->'participants') p where p->>'name'='Castor927' and (p->>'duration_seconds')::int=75)=1,'renamed participant';
 assert (select count(*) from jsonb_array_elements(item->'participants') p where p->>'name'='Blaireau927' and (p->>'duration_seconds')::int=90)=1,'guest participant keeps the stored name';
 assert (select count(*) from jsonb_array_elements(item->'participants') p where p->>'name'='Sans927' and p->>'status'='started')=1,'an account without a ready nickname keeps the stored name';
 assert (select jsonb_agg(p-'name' order by p->>'duration_seconds') from jsonb_array_elements(item->'participants') p)=
  (select jsonb_agg(p-'name' order by p->>'duration_seconds') from jsonb_array_elements((select i from jsonb_array_elements(before) i where (i->>'challenge_id')::uuid=link)->'participants') p),
  'only names change: times, statuses, badges and order are identical';
 assert (item-'participants')=((select i from jsonb_array_elements(before) i where (i->>'challenge_id')::uuid=link)-'participants'),'challenge row unchanged';
 assert (select participant_display_name from lumen.social_challenge_participations where challenge_id=link and participant_user_id=blaireau)='Blaireau927',
  'stored snapshots are kept for diagnosis';
 -- The v1 readers used by older clients resolve the same way.
 assert (select sender_display_name from public.lumen_get_social_challenge(link,null,'Orion927'))='Orion927','v1 get resolves too';
 -- No identifier or email leaks; only nicknames.
 txt:=after::text||public.lumen_get_quest_challenge_v2(link,null,'Orion927')::text;
 assert position(blaireau::text in txt)=0 and position(loutre::text in txt)=0 and txt !~ '@','no user ID or email exposed';
 -- Another player still cannot list Loutre's challenges.
 perform set_config('request.jwt.claim.sub',blaireau::text,true);
 assert not exists(select 1 from jsonb_array_elements(public.lumen_list_quest_challenges_v2(null,'Castor927')) i where (i->>'challenge_id')::uuid=link),'no foreign listing';

 -- Erased account: the anonymized snapshot is shown, never the old nickname.
 perform lumen_privacy.erase_account(erased,array[]::text[],'ERASE LUMEN '||erased::text);
 perform set_config('request.jwt.claim.sub',blaireau::text,true);
 assert public.lumen_get_quest_challenge_v2(gone_link,null,'Castor927')->>'sender_display_name'='Compte supprimé','erased sender stays anonymous';
 assert not has_function_privilege('anon','lumen.public_nickname(uuid,text)','execute'),'resolver is private';
 raise notice 'current-nicknames-927: ok';
end $$;
rollback;
