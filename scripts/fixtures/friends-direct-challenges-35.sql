-- #35 (EPIC #881 Lot 2): friends, direct challenges, privacy and erasure on the
-- real migrated schema. Disposable fixture only: invented identities, rolled back.
begin;
do $$
declare
 alice constant uuid:='00000000-0000-4000-8000-000000035001';
 bruno constant uuid:='00000000-0000-4000-8000-000000035002';
 chloe constant uuid:='00000000-0000-4000-8000-000000035003';
 nobody constant uuid:='00000000-0000-4000-8000-000000035004';
 quest text;link uuid;x jsonb;inbox jsonb;i integer;extra uuid;first_part uuid;again uuid;
begin
 insert into auth.users(id) values(alice),(bruno),(chloe),(nobody);
 insert into lumen.profiles(user_id,nickname) values(alice,'Alice35'),(bruno,'Bruno35'),(chloe,'Chloe35');
 select quest_id into quest from lumen_commands.quest_rules where legacy_index is null and grid_revision=0 order by quest_id limit 1;

 -- Accounts only, with a chosen nickname.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_friend_search('Bruno35');raise exception 'guest searched';
 exception when insufficient_privilege then if sqlerrm<>'account_required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',nobody::text,true);
 begin perform public.lumen_friend_request('Bruno35');raise exception 'no-nickname request';
 exception when insufficient_privilege then if sqlerrm<>'nickname_required' then raise;end if;end;

 -- Exact, case-insensitive nickname search; no enumeration, no technical data.
 perform set_config('request.jwt.claim.sub',alice::text,true);
 x:=public.lumen_friend_search('  bruno35 ');
 assert x=jsonb_build_object('nickname','Bruno35','state','none'),'search returns only nickname and relation';
 assert public.lumen_friend_search('Bru') is null and public.lumen_friend_search('Alice35') is null,'no partial search, no self';
 begin perform public.lumen_friend_request('Unknown35');raise exception 'unknown accepted';
 exception when raise_exception then if sqlerrm<>'player_not_found' then raise;end if;end;

 -- Request, idempotent re-send, quiet decline and 30-day cooldown.
 assert public.lumen_friend_request('Bruno35')='outgoing';
 assert public.lumen_friend_request('bruno35')='outgoing','duplicate request is idempotent';
 assert (select count(*) from lumen.social_friend_edges where user_id in (alice,bruno) and friend_user_id in (alice,bruno))=2,'one edge per player';
 perform set_config('request.jwt.claim.sub',bruno::text,true);
 assert public.lumen_friend_list()=jsonb_build_array(jsonb_build_object('nickname','Alice35','state','incoming','since',(select updated_at from lumen.social_friend_edges where user_id=bruno and friend_user_id=alice))),'incoming request listed';
 assert public.lumen_friend_list()::text !~ '0000-4000','no technical identifier in lists';
 assert public.lumen_friend_respond('Alice35',false)='declined';
 perform set_config('request.jwt.claim.sub',alice::text,true);
 assert public.lumen_friend_list()='[]'::jsonb,'a declined request disappears quietly';
 begin perform public.lumen_friend_request('Bruno35');raise exception 'cooldown bypassed';
 exception when raise_exception then if sqlerrm<>'request_cooldown' then raise;end if;end;
 begin perform public.lumen_friend_respond('Bruno35',true);raise exception 'accepted without request';
 exception when raise_exception then if sqlerrm<>'no_pending_request' then raise;end if;end;

 -- Crossing requests become a friendship.
 perform set_config('request.jwt.claim.sub',chloe::text,true);
 assert public.lumen_friend_request('Alice35')='outgoing';
 perform set_config('request.jwt.claim.sub',alice::text,true);
 assert public.lumen_friend_request('Chloe35')='friends','mutual request accepts';
 assert (select count(*) from lumen.social_friend_edges where state='friends' and user_id in (alice,chloe) and friend_user_id in (alice,chloe))=2;

 -- Direct challenge: an existing qualifying challenge of the sender, to a friend only.
 select challenge_id into link from public.lumen_create_qualifying_challenge(null,'Alice35',null,quest,0,70,true,false,false,false,false,true);
 assert public.lumen_challenge_send_to_friend(link,'Chloe35')='sent';
 assert public.lumen_challenge_send_to_friend(link,'chloe35')='already_sent','one invite per friend and challenge';
 begin perform public.lumen_challenge_send_to_friend(link,'Bruno35');raise exception 'non-friend invited';
 exception when raise_exception then if sqlerrm<>'not_friends' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',chloe::text,true);
 begin perform public.lumen_challenge_send_to_friend(link,'Alice35');raise exception 'foreign challenge sent';
 exception when raise_exception then if sqlerrm<>'not_challenge_owner' then raise;end if;end;

 -- Received: sender nickname, provenance, pending; the reference stays hidden.
 inbox:=public.lumen_challenge_inbox();
 assert jsonb_array_length(inbox->'received')=1 and inbox->'received'->0->>'sender'='Alice35' and inbox->'received'->0->>'status'='pending';
 assert inbox->'received'->0->>'source_first_play'='false','replay provenance travels with the invite';
 assert not (inbox->'received'->0 ? 'source_duration_seconds'),'reference hidden before the attempt';
 -- One participation per recipient, through the existing one-shot engine.
 select participation_id into first_part from public.lumen_start_social_challenge(link,null,'Chloe35',false);
 select participation_id into again from public.lumen_start_social_challenge(link,null,'Chloe35',false);
 assert first_part=again,'one attempt per recipient';
 assert public.lumen_challenge_inbox()->'received'->0->>'status'='started';
 perform set_config('request.jwt.claim.sub',alice::text,true);
 inbox:=public.lumen_challenge_inbox();
 assert inbox->'sent'->0->>'recipient'='Chloe35' and inbox->'sent'->0->>'status'='started' and inbox->'sent'->0->'duration_seconds'='null';
 perform set_config('request.jwt.claim.sub',chloe::text,true);
 perform public.lumen_finish_social_challenge(link,null,'Chloe35','completed',64,true,false,false,false);
 perform set_config('request.jwt.claim.sub',alice::text,true);
 assert public.lumen_challenge_inbox()->'sent'->0->>'duration_seconds'='64','sender sees the finished result';

 -- Removing a friend removes both edges and further invites; past invites stay.
 assert public.lumen_friend_remove('Chloe35')='removed';
 assert not exists(select 1 from lumen.social_friend_edges where user_id in (alice,chloe) and friend_user_id in (alice,chloe));
 begin perform public.lumen_challenge_send_to_friend(link,'Chloe35');raise exception 'removed friend invited';
 exception when raise_exception then if sqlerrm not in ('not_friends','already_sent') then raise;end if;end;

 -- Daily request limit.
 for i in 1..11 loop
  extra:=('00000000-0000-4000-8000-0000003551'||lpad(i::text,2,'0'))::uuid;
  insert into auth.users(id) values(extra);insert into lumen.profiles(user_id,nickname) values(extra,'Extra35n'||i);
  if i<=10 then assert public.lumen_friend_request('Extra35n'||i)='outgoing';
  else begin perform public.lumen_friend_request('Extra35n'||i);raise exception 'rate limit bypassed';
   exception when raise_exception then if sqlerrm<>'rate_limited' then raise;end if;end;
  end if;
 end loop;

 -- Privacy surface.
 assert not has_table_privilege('authenticated','lumen.social_friend_edges','SELECT') and not has_table_privilege('anon','lumen.social_challenge_invites','SELECT');
 assert not has_function_privilege('anon','public.lumen_friend_list()','execute') and has_function_privilege('authenticated','public.lumen_challenge_inbox()','execute');
 assert not has_function_privilege('authenticated','lumen.social_caller()','execute'),'helpers stay private';

 -- Lumen erasure: Chloe's edges, other players' edges to her and her invites go;
 -- Alice's challenge stays.
 perform set_config('request.jwt.claim.sub',chloe::text,true);
 perform public.lumen_friend_request('Alice35');
 perform set_config('request.jwt.claim.sub',alice::text,true);
 perform public.lumen_friend_respond('Chloe35',true);
 perform set_config('request.jwt.claim.sub','',true);
 x:=lumen_privacy.review_erasure(chloe,array[]::text[]);
 assert (x->'tables'->'lumen.social_friend_edges'->>'rows')::integer=1 and (x->'tables'->'lumen.social_challenge_invites'->>'rows')::integer=1,'erasure review sees both tables';
 perform lumen_privacy.erase_account(chloe,array[]::text[],'ERASE LUMEN '||chloe::text);
 assert not exists(select 1 from lumen.social_friend_edges where user_id=chloe or friend_user_id=chloe),'no edge survives erasure';
 assert not exists(select 1 from lumen.social_challenge_invites where recipient_user_id=chloe);
 assert exists(select 1 from lumen.social_challenges where id=link),'the sender keeps the challenge';
end $$;
rollback;
