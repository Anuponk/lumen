-- #883 (Lot 0, EPIC #881): one-shot challenge RPC matrix on the real migrated
-- schema. Disposable fixture only: no real identifiers, rolled back.
-- Each row mirrors the client routing in src/campaign/social-challenge.js:
--  * historical number  -> create_social / start_social / finish_social (revision 0)
--  * stable, revision 0 -> create_quest  / start_social / finish_social (revision 0)
--  * stable, revised    -> create_quest_v2 / start_quest_v2 / finish_quest_v2
-- The public start/finish_social wrappers only refuse revision <> 0, so a
-- stable revision-0 challenge is accepted by them (audited 20/11/2026).
begin;
do $$
declare
 legacy_quest text;legacy_number integer;stable_zero text;revised text;revised_rev integer;
 kinds text[]:=array['legacy','stable-zero','stable-revised'];kind text;
 link uuid;quest text;rev integer;first_part uuid;again uuid;outcome text;x jsonb;listed jsonb;
 profiles bigint;days bigint;recipient_user uuid:='00000000-0000-4000-8000-000000008831';
begin
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into profiles from lumen.profile_snapshots;select count(*) into days from lumen.daily_progress;
 -- Historical quest of a locked Adventure (index >= 79): the recipient must
 -- be able to play exactly this grid without owning the Adventure.
 select quest_id,legacy_index+1 into legacy_quest,legacy_number from lumen_commands.quest_rules
  where legacy_index>=79 order by legacy_index limit 1;
 select quest_id into stable_zero from lumen_commands.quest_rules
  where legacy_index is null and grid_revision=0 order by quest_id limit 1;
 select quest_id,grid_revision into revised,revised_rev from lumen_commands.quest_rules
  where legacy_index is null and grid_revision>0 order by grid_revision desc,quest_id limit 1;
 assert legacy_quest is not null and stable_zero is not null and revised is not null,'matrix needs the three quest kinds';

 foreach kind in array kinds loop
  perform set_config('request.jwt.claim.sub','',true);
  if kind='legacy' then
   select challenge_id into link from public.lumen_create_social_challenge('matrix-sender-883','Sender',legacy_number,61,true,true,false,false,true);
   quest:=legacy_quest;rev:=0;
  elsif kind='stable-zero' then
   select challenge_id into link from public.lumen_create_quest_challenge('matrix-sender-883','Sender',stable_zero,62,true,false,false,false,true);
   quest:=stable_zero;rev:=0;
  else
   select challenge_id into link from public.lumen_create_quest_challenge_v2('matrix-sender-883','Sender',revised,63,true,true,true,false,true,revised_rev);
   quest:=revised;rev:=revised_rev;
  end if;

  -- Reading: identity resolves to the same grid, source performance hidden.
  x:=public.lumen_get_quest_challenge_v2(link,'matrix-recipient-883','Recipient');
  assert x->>'stable_quest_id'=quest and (x->>'grid_revision')::integer=rev,kind||': same quest and revision';
  assert (x->'puzzle_id'='null')=(kind<>'legacy'),kind||': numeric identity only for historical links';
  assert x->'source_duration_seconds'='null' and x->'source_mastery'='null' and x->'participant_status'='null',kind||': reference hidden before the attempt';

  -- Start through the route the client selects for this revision.
  if rev=0 then
   select participation_id,status into first_part,outcome from public.lumen_start_social_challenge(link,'matrix-recipient-883','Recipient',false);
   select participation_id into again from public.lumen_start_social_challenge(link,'matrix-recipient-883','Recipient',false);
  else
   begin perform public.lumen_start_social_challenge(link,'matrix-recipient-883','Recipient',false);raise exception 'old start accepted a revised grid';
   exception when raise_exception then if sqlerrm<>'challenge_grid_update_required' then raise;end if;end;
   select participation_id,status into first_part,outcome from public.lumen_start_quest_challenge_v2(link,'matrix-recipient-883','Recipient',false,rev);
   select participation_id into again from public.lumen_start_quest_challenge_v2(link,'matrix-recipient-883','Recipient',false,rev);
  end if;
  assert outcome='started' and first_part=again,kind||': one participation survives reload';
  x:=public.lumen_get_quest_challenge_v2(link,'matrix-recipient-883','Recipient');
  assert x->>'participant_status'='started' and x->'source_duration_seconds'='null',kind||': reference hidden during the attempt';

  -- Finish once; a second terminal call never rewrites the result.
  if rev=0 then
   perform public.lumen_finish_social_challenge(link,'matrix-recipient-883','Recipient','completed',58,true,true,true,false);
   select status into outcome from public.lumen_finish_social_challenge(link,'matrix-recipient-883','Recipient','abandoned',1,false,false,false,true);
  else
   perform public.lumen_finish_quest_challenge_v2(link,'matrix-recipient-883','Recipient','completed',58,true,true,true,false,rev);
   select status into outcome from public.lumen_finish_quest_challenge_v2(link,'matrix-recipient-883','Recipient','abandoned',1,false,false,false,true,rev);
  end if;
  assert outcome='completed',kind||': terminal result is immutable';
  x:=public.lumen_get_quest_challenge_v2(link,'matrix-recipient-883','Recipient');
  -- The client compares this exact lowercase value to skip a second attempt.
  assert x->>'participant_status'='completed',kind||': terminal status is lowercase';
  assert x->>'participant_duration_seconds'='58' and x->>'source_duration_seconds' is not null,kind||': reveal after the attempt';

  -- Second profile (signed-in) abandons: its own one-shot, isolated from the first.
  insert into auth.users(id) values(recipient_user) on conflict do nothing;
  perform set_config('request.jwt.claim.sub',recipient_user::text,true);
  if rev=0 then
   perform public.lumen_start_social_challenge(link,null,'Member',true);
   perform public.lumen_finish_social_challenge(link,null,'Member','abandoned',0,false,false,false,false);
  else
   perform public.lumen_start_quest_challenge_v2(link,null,'Member',true,rev);
   perform public.lumen_finish_quest_challenge_v2(link,null,'Member','abandoned',0,false,false,false,false,rev);
  end if;
  assert public.lumen_get_quest_challenge_v2(link,null,'Member')->>'participant_status'='abandoned',kind||': abandon is terminal';

  -- Sender inbox ("Mes défis") lists both results with the stable identity.
  perform set_config('request.jwt.claim.sub','',true);
  select item into listed from jsonb_array_elements(public.lumen_list_quest_challenges_v2('matrix-sender-883','Sender')) item
   where item->>'challenge_id'=link::text;
  assert listed->>'stable_quest_id'=quest and (listed->>'grid_revision')::integer=rev,kind||': inbox keeps the quest identity';
  assert (listed->>'participant_count')::integer=2 and (listed->>'unread_count')::integer=2,kind||': inbox counts both participants';
  assert public.lumen_mark_social_challenge_read(link,'matrix-sender-883','Sender')=2,kind||': sender marks results read';
  assert not exists(select 1 from jsonb_array_elements(public.lumen_list_quest_challenges_v2('matrix-other-883','Other')) item
   where item->>'challenge_id'=link::text),kind||': inbox stays private';
 end loop;

 -- Old (pre-revision) canonical readers never see a revised grid as revision 0.
 assert not exists(select 1 from jsonb_array_elements(public.lumen_list_quest_challenges('matrix-sender-883','Sender')) item
  where (item->>'grid_revision')::integer<>0),'old inbox excludes revised grids';
 assert (select count(*) from lumen.profile_snapshots)=profiles and (select count(*) from lumen.daily_progress)=days,
  'challenges never write campaign progress';
 assert (select count(*) from lumen.social_challenge_participations p join lumen.social_challenges c on c.id=p.challenge_id
  where c.sender_anonymous_id='matrix-sender-883')=6,'exactly one participation per profile and challenge';
end $$;
rollback;
