-- Disposable fixture only. No real player identifiers or production execution.
begin;
do $$
declare id uuid;old_id uuid;item jsonb;profiles bigint;participants uuid;bad_revision integer;
begin
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into profiles from lumen.profile_snapshots;
 select challenge_id into old_id from public.lumen_create_quest_challenge('sender-640-guest','Sender','pack-real-adventure-05-q001',40,true,true,true,false,true);
 assert public.lumen_get_quest_challenge(old_id,'recipient-640-guest','Recipient')->>'grid_revision'='0','Old API keeps original puzzle';
 select challenge_id into id from public.lumen_create_quest_challenge_v2('sender-640-guest','Sender','pack-real-adventure-05-q001',400,true,true,true,false,true,1);
 item:=public.lumen_get_quest_challenge(id,'recipient-640-guest','Recipient');
 assert item->>'grid_revision'='1','New grid revision round trips';
 assert item->'source_duration_seconds'='null','Version does not reveal hidden performance';
 select participation_id into participants from public.lumen_start_social_challenge(id,'recipient-640-guest','Recipient',false);
 assert participants=(select participation_id from public.lumen_start_social_challenge(id,'recipient-640-guest','Recipient',false)),'One attempt survives reload';
 perform public.lumen_finish_social_challenge(id,'recipient-640-guest','Recipient','completed',450,true,true,true,false);
 item:=public.lumen_get_quest_challenge(id,'recipient-640-guest','Recipient');
 assert item->>'grid_revision'='1' and item->>'source_duration_seconds'='400','Terminal reveal uses same revision';
 assert jsonb_array_length(public.lumen_list_quest_challenges('unrelated-640-guest','Other'))=0,'Inbox privacy unchanged';
 assert public.lumen_list_quest_challenges('sender-640-guest','Sender') @> '[{"grid_revision":1}]'::jsonb,'Sent inbox keeps revision';
 foreach bad_revision in array array[-1,0,2] loop
  begin
   perform public.lumen_create_quest_challenge_v2('sender-640-guest','Sender','pack-real-adventure-05-q001',1,true,true,true,false,true,bad_revision);
   raise exception 'accepted_bad_revision';
  exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 end loop;
 begin
  perform public.lumen_create_quest_challenge_v2('sender-640-guest','Sender','pack-real-adventure-09-q001',1,true,true,true,false,true,1);
  raise exception 'accepted_wrong_scope';
 exception when raise_exception then if sqlerrm<>'invalid_grid_revision' then raise;end if;end;
 begin
  perform public.lumen_create_quest_challenge_v2('sender-640-guest','Sender','pack-real-adventure-05-q999',1,true,true,true,false,true,1);
  raise exception 'accepted_unknown_quest';
 exception when raise_exception then if sqlerrm<>'invalid_quest' then raise;end if;end;
 begin
  perform public.lumen_create_quest_challenge_v2('sender-640-guest','Sender','pack-real-adventure-05-q001',1,true,true,true,false,false,1);
  raise exception 'accepted_replay';
 exception when raise_exception then if sqlerrm<>'challenge_requires_first_play' then raise;end if;end;
 assert not has_function_privilege('public','public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer)','execute'),'PUBLIC cannot call privileged function';
 assert has_function_privilege('anon','public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer)','execute'),'Guest API stays supported';
 assert (select count(*) from lumen.profile_snapshots)=profiles,'No campaign write';
end $$;
rollback;
