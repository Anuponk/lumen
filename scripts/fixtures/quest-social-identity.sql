-- Isolated identities and schema only. Challenges never write campaign data.
do $$
declare q text;id uuid;old_id uuid;start1 uuid;start2 uuid;x jsonb;profiles bigint;days bigint;
begin
 perform set_config('request.jwt.claim.sub','',true);
 select quest_id into q from lumen_commands.quest_rules where legacy_index is null order by (rules->>'ordinal')::integer limit 1;
 select count(*) into profiles from lumen.profile_snapshots;select count(*) into days from lumen.daily_progress;
 select challenge_id into id from public.lumen_create_quest_challenge('guest-sender-522','Sender',q,45,true,true,true,false,true);
 x:=public.lumen_get_quest_challenge(id,'guest-recipient-522','Recipient');
 assert x->>'stable_quest_id'=q and x->'puzzle_id'='null','stable grid has no fabricated numeric identity';
 assert x->'source_duration_seconds'='null' and x->'source_mastery'='null','reference stays hidden before terminal';
 select participation_id into start1 from public.lumen_start_social_challenge(id,'guest-recipient-522','Recipient',true);
 select participation_id into start2 from public.lumen_start_social_challenge(id,'guest-recipient-522','Recipient',true);
 assert start1=start2,'reload retains the one attempt';
 x:=public.lumen_get_quest_challenge(id,'guest-recipient-522','Recipient');
 assert x->'source_duration_seconds'='null','reference hidden during attempt';
 perform public.lumen_finish_social_challenge(id,'guest-recipient-522','Recipient','completed',50,true,true,true,false);
 x:=public.lumen_get_quest_challenge(id,'guest-recipient-522','Recipient');
 assert x->>'source_duration_seconds'='45' and x->>'previously_played'='true','terminal reveal preserves exposure metadata';
 assert jsonb_array_length(public.lumen_list_quest_challenges('unrelated-guest-522','Other'))=0,'inbox remains private';
 assert public.lumen_list_quest_challenges('guest-sender-522','Sender')->0->>'stable_quest_id'=q;
 select challenge_id into old_id from public.lumen_create_social_challenge('guest-sender-522','Sender',39,50,false,true,false,true,true);
 assert public.lumen_get_quest_challenge(old_id,'guest-recipient-522','Recipient')->>'stable_quest_id'='base-q039','historical links keep their original grid';
 begin perform public.lumen_create_quest_challenge('guest-sender-522','Sender',q,45,true,true,true,false,false);raise exception 'replay reference accepted';
 exception when raise_exception then if sqlerrm<>'challenge_requires_first_play' then raise;end if;end;
 assert (select count(*)=profiles from lumen.profile_snapshots) and (select count(*)=days from lumen.daily_progress),'social writes never create campaign or daily data';
end $$;
