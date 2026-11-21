-- #887: a challenge stays pinned to the board its sender played. Real migrated
-- schema; disposable fixture only (invented identities), rolled back.
begin;
do $$
declare
 sender constant uuid:='00000000-0000-4000-8000-000000887001';
 friend constant uuid:='00000000-0000-4000-8000-000000887002';
 latecomer constant uuid:='00000000-0000-4000-8000-000000887003';
 revised text;revised_number integer;plain text;plain_number integer;
 before_switch uuid;after_switch uuid;own_rev0 uuid;stale_run uuid;fresh uuid;stale uuid;guest uuid;
 x jsonb;listed jsonb;part jsonb;outcome text;n integer;scores_before jsonb;
begin
 insert into auth.users(id) values(sender),(friend),(latecomer);
 -- A numbered quest that moved to revision 1 (#650) and one that never moved.
 select quest_id,legacy_index+1 into revised,revised_number from lumen_commands.quest_rules
  where legacy_index between 2 and 6 order by legacy_index limit 1;
 select quest_id,legacy_index+1 into plain,plain_number from lumen_commands.quest_rules
  where legacy_index is not null and legacy_index>20 and grid_revision=0 order by legacy_index limit 1;
 assert revised is not null and plain is not null,'fixture needs two numbered quests';
 update lumen_commands.quest_rules set grid_revision=1 where quest_id=revised;

 -- Historical rows exactly as production stored them (numbered path, revision 0).
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_display_name,source_duration_seconds,created_at)
  values(revised_number,sender,'Sender887',90,now()-interval '40 days') returning id into before_switch;
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_display_name,source_duration_seconds,created_at)
  values(revised_number,sender,'Sender887',61,now()-interval '1 day') returning id into after_switch;
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_display_name,source_duration_seconds,created_at)
  values(revised_number,sender,'Sender887',70,now()-interval '2 days') returning id into own_rev0;
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_display_name,source_duration_seconds,created_at)
  values(revised_number,sender,'Sender887',75,now()-interval '3 days') returning id into stale_run;
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible) values
  (sender,'887-after',revised,1,now()-interval '1 day'-interval '2 minutes',true),
  (sender,'887-own-rev0',revised,0,now()-interval '2 days'-interval '1 minute',true),
  (sender,'887-too-old',revised,1,now()-interval '3 days'-interval '45 minutes',true);

 -- A friend already played the post-switch link on the old board (v1 path).
 perform set_config('request.jwt.claim.sub',friend::text,true);
 perform public.lumen_start_social_challenge(after_switch,null,'Friend887',false);
 perform public.lumen_finish_social_challenge(after_switch,null,'Friend887','completed',58,true,true,false,false);
 select jsonb_agg(to_jsonb(p) order by p.id) into scores_before from (select id,status,duration_seconds,autonomy,speed,mastery,completed_at
  from lumen.social_challenge_participations where challenge_id=after_switch) p;

 -- Repair: only the challenge with evidence moves; replay finds nothing.
 n:=lumen.repair_challenge_grid_revisions_887();
 assert n=1,'exactly one challenge repaired, got '||n;
 assert (select grid_revision from lumen.social_challenges where id=after_switch)=1,'post-switch challenge pinned to revision 1';
 assert (select grid_revision from lumen.social_challenges where id=before_switch)=0,'pre-switch challenge keeps revision 0';
 assert (select grid_revision from lumen.social_challenges where id=own_rev0)=0,'a sender run on revision 0 keeps revision 0';
 assert (select grid_revision from lumen.social_challenges where id=stale_run)=0,'evidence older than 30 min is not enough';
 assert lumen.repair_challenge_grid_revisions_887()=0,'the repair is idempotent';
 assert (select board_mismatch from lumen.social_challenge_participations where challenge_id=after_switch),'old-board result flagged';
 assert (select jsonb_agg(to_jsonb(p) order by p.id) from (select id,status,duration_seconds,autonomy,speed,mastery,completed_at
  from lumen.social_challenge_participations where challenge_id=after_switch) p)=scores_before,'no time, badge or status changed';
 assert (select source_duration_seconds from lumen.social_challenges where id=after_switch)=61,'sender time unchanged';

 -- Readers: the friend sees the flag on their own result; the sender's list too.
 x:=public.lumen_get_quest_challenge_v2(after_switch,null,'Friend887');
 assert (x->>'grid_revision')::int=1 and (x->>'participant_board_mismatch')::boolean,'get_v2 exposes revision and flag';
 assert (x->>'participant_duration_seconds')::int=58,'result preserved';
 perform set_config('request.jwt.claim.sub',sender::text,true);
 listed:=public.lumen_list_quest_challenges_v2(null,'Sender887');
 select item into x from jsonb_array_elements(listed) item where (item->>'challenge_id')::uuid=after_switch;
 part:=x->'participants'->0;
 assert (part->>'board_mismatch')::boolean and (part->>'duration_seconds')::int=58 and part->>'name'='Friend887','list_v2 flags the participant';
 assert jsonb_array_length(listed)=4,'the sender lists exactly their own challenges';
 -- Old clients cannot replay a repaired link on the old board.
 perform set_config('request.jwt.claim.sub',latecomer::text,true);
 assert public.lumen_get_quest_challenge(after_switch,null,'Late887') is null,'v1 reader hides revised rows';
 begin perform public.lumen_start_social_challenge(after_switch,null,'Late887',false);raise exception 'v1 start accepted';
 exception when raise_exception then if sqlerrm<>'challenge_grid_update_required' then raise;end if;end;
 -- An updated client plays the sender's board; its result is comparable.
 select status into outcome from public.lumen_start_quest_challenge_v2(after_switch,null,'Late887',false,1);
 assert outcome='started','v2 start on the pinned revision';
 perform public.lumen_finish_quest_challenge_v2(after_switch,null,'Late887','completed',63,true,false,false,false,1);
 assert not (select board_mismatch from lumen.social_challenge_participations where challenge_id=after_switch and participant_user_id=latecomer),
  'a result on the pinned board is comparable';
 -- Another player never sees someone else's challenge list.
 assert jsonb_array_length(public.lumen_list_quest_challenges_v2(null,'Late887'))=0,'no foreign listing';

 -- Writer: new clients pin the played revision on the numbered path.
 perform set_config('request.jwt.claim.sub',sender::text,true);
 select challenge_id into fresh from public.lumen_create_qualifying_challenge(null,'Sender887',revised_number,null,1,55,true,true,false,false,true,true);
 assert (select grid_revision from lumen.social_challenges where id=fresh)=1,'new numbered challenge pinned to revision 1';
 begin perform public.lumen_create_qualifying_challenge(null,'Sender887',revised_number,null,2,55,true,true,false,false,true,true);raise exception 'unknown revision accepted';
 exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 begin perform public.lumen_create_qualifying_challenge(null,'Sender887',plain_number,null,1,55,true,true,false,false,true,true);raise exception 'revision on unrevised quest accepted';
 exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 assert (select grid_revision from lumen.social_challenges where id=(select challenge_id from public.lumen_create_qualifying_challenge(null,'Sender887',plain_number,null,0,55,true,true,false,false,true,true)))=0,
  'unrevised quest stays revision 0';
 -- An older client (sends 0) is corrected from the sender's fresh official run.
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible)
  values(sender,'887-stale-client',revised,1,now()-interval '1 minute',true);
 select challenge_id into stale from public.lumen_create_qualifying_challenge(null,'Sender887',revised_number,null,0,55,true,true,false,false,true,true);
 assert (select grid_revision from lumen.social_challenges where id=stale)=1,'stale client corrected by its own run';
 -- A guest has no server run: revision 0 is kept as declared (documented limit).
 perform set_config('request.jwt.claim.sub','',true);
 select challenge_id into guest from public.lumen_create_qualifying_challenge('guest-887-sender','Guest887',revised_number,null,0,55,true,true,false,false,true,true);
 assert (select grid_revision from lumen.social_challenges where id=guest)=0,'guest declaration kept';
 -- The evidence helper is private.
 assert not has_function_privilege('anon','lumen.challenge_played_revision(uuid,text,timestamptz)','execute'),'helper private (anon)';
 assert not has_function_privilege('authenticated','lumen.repair_challenge_grid_revisions_887()','execute'),'repair private';
 raise notice 'challenge-grid-revision-887: ok';
end $$;
rollback;
