-- #889 / #888: qualifying-run challenges and resume facts on the real migrated
-- schema. Disposable fixture only: no real identifiers, rolled back.
begin;
do $$
declare
 legacy_number integer;stable_zero text;revised text;revised_rev integer;
 link uuid;replay_link uuid;revised_link uuid;x jsonb;other jsonb;started timestamptz;listed jsonb;profiles bigint;days bigint;
begin
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into profiles from lumen.profile_snapshots;select count(*) into days from lumen.daily_progress;
 select legacy_index+1 into legacy_number from lumen_commands.quest_rules where legacy_index is not null and grid_revision=0 order by legacy_index limit 1;
 select quest_id into stable_zero from lumen_commands.quest_rules where legacy_index is null and grid_revision=0 order by quest_id limit 1;
 select quest_id,grid_revision into revised,revised_rev from lumen_commands.quest_rules where legacy_index is null and grid_revision>0 order by quest_id limit 1;

 -- First qualifying win (historical number) and qualifying replay (stable).
 select challenge_id into link from public.lumen_create_qualifying_challenge('q889-sender','Sender',legacy_number,null,0,70,true,false,false,false,true,true);
 select challenge_id into replay_link from public.lumen_create_qualifying_challenge('q889-sender','Sender',null,stable_zero,0,55,false,false,false,true,false,true);
 select challenge_id into revised_link from public.lumen_create_qualifying_challenge('q889-sender','Sender',null,revised,revised_rev,80,true,true,true,false,false,true);
 assert (select source_first_play from lumen.social_challenges where id=link),'first win keeps first-play provenance';
 assert not (select source_first_play from lumen.social_challenges where id=replay_link),'a replay is never stored as first play';
 assert (select grid_revision from lumen.social_challenges where id=revised_link)=revised_rev,'revised board pinned';
 assert (select source_assistance_used from lumen.social_challenges where id=replay_link),'assisted qualifying run is accepted and recorded';
 -- Passing on an old revision-0 link keeps the original board, as the v1 writer did.
 -- (Two statements: a row inserted by a function is not visible to the same query's snapshot.)
 select challenge_id into link from public.lumen_create_qualifying_challenge('q889-sender','Sender',null,revised,0,90,true,false,false,false,true,true);
 assert (select grid_revision from lumen.social_challenges where id=link)=0,'original board stays challengeable';
 select challenge_id into link from public.lumen_create_qualifying_challenge('q889-sender','Sender',legacy_number,null,0,70,true,false,false,false,true,true);

 -- Refusals: non-qualifying run, wrong board revision, unknown quest, legacy revision.
 begin perform public.lumen_create_qualifying_challenge('q889-sender','Sender',null,stable_zero,0,10,true,true,true,false,false,false);raise exception 'non-qualifying accepted';
 exception when raise_exception then if sqlerrm<>'challenge_requires_qualifying_run' then raise;end if;end;
 begin perform public.lumen_create_qualifying_challenge('q889-sender','Sender',null,revised,revised_rev+1,10,true,true,true,false,true,true);raise exception 'unknown revision accepted';
 exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 begin perform public.lumen_create_qualifying_challenge('q889-sender','Sender',null,'unknown-quest-889',0,10,true,true,true,false,true,true);raise exception 'unknown quest accepted';
 exception when raise_exception then if sqlerrm<>'invalid_quest' then raise;end if;end;
 begin perform public.lumen_create_qualifying_challenge('q889-sender','Sender',legacy_number,null,1,10,true,true,true,false,true,true);raise exception 'legacy revision accepted';
 exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 -- Older clients keep their first-play contract unchanged.
 begin perform public.lumen_create_quest_challenge('q889-sender','Sender',stable_zero,10,true,true,true,false,false);raise exception 'old writer accepted a replay';
 exception when raise_exception then if sqlerrm<>'challenge_requires_first_play' then raise;end if;end;

 -- Readers expose provenance; the caller's own start time only after starting.
 x:=public.lumen_get_quest_challenge_v2(replay_link,'q889-recipient','Recipient');
 assert x->>'source_first_play'='false' and x->'source_duration_seconds'='null','provenance visible, reference still hidden';
 assert x->'participant_started_at'='null' and x->>'server_now' is not null,'no start before the attempt';
 perform public.lumen_start_social_challenge(replay_link,'q889-recipient','Recipient',false);
 select started_at into started from lumen.social_challenge_participations where challenge_id=replay_link and participant_key='a:q889-recipient';
 x:=public.lumen_get_quest_challenge_v2(replay_link,'q889-recipient','Recipient');
 assert (x->>'participant_started_at')::timestamptz=started,'resume reads the original server start';
 other:=public.lumen_get_quest_challenge_v2(replay_link,'q889-other','Other');
 assert other->'participant_started_at'='null','never another participant''s start';
 -- Restarting on another device returns the same participation, never a new one.
 perform public.lumen_start_social_challenge(replay_link,'q889-recipient','Recipient',false);
 assert (select count(*) from lumen.social_challenge_participations where challenge_id=replay_link)=1,'one participation per recipient';
 assert (select started_at from lumen.social_challenge_participations where challenge_id=replay_link and participant_key='a:q889-recipient')=started,'start time is immutable';

 select item into listed from jsonb_array_elements(public.lumen_list_quest_challenges_v2('q889-sender','Sender')) item where item->>'challenge_id'=replay_link::text;
 assert listed->>'source_first_play'='false','Mes défis shows the replay provenance';
 assert has_function_privilege('anon','public.lumen_create_qualifying_challenge(text,text,integer,text,integer,integer,boolean,boolean,boolean,boolean,boolean,boolean)','execute');
 assert not has_function_privilege('public','public.lumen_create_qualifying_challenge(text,text,integer,text,integer,integer,boolean,boolean,boolean,boolean,boolean,boolean)','execute');
 assert (select count(*) from lumen.profile_snapshots)=profiles and (select count(*) from lumen.daily_progress)=days,'challenges never write campaign progress';
end $$;
rollback;
