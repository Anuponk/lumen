-- #929 (EPIC #928 V1): private circles on the real migrated schema, with
-- negative authorization tests. Disposable fixture (invented identities),
-- rolled back.
begin;
do $$
declare
 ana constant uuid:='00000000-0000-4000-8000-000000929001';   -- owner
 ben constant uuid:='00000000-0000-4000-8000-000000929002';   -- friend of Ana, invited
 cleo constant uuid:='00000000-0000-4000-8000-000000929003';  -- joins by link
 dan constant uuid:='00000000-0000-4000-8000-000000929004';   -- outsider
 eve constant uuid:='00000000-0000-4000-8000-000000929005';   -- friend who refuses
 nonick constant uuid:='00000000-0000-4000-8000-000000929006';-- account without nickname
 circle uuid;other uuid;x jsonb;inv uuid;tok text;tok2 text;link uuid;i integer;q text;rev integer;public_before jsonb;txt text;
 extra uuid[];u uuid;
begin
 insert into auth.users(id) values(ana),(ben),(cleo),(dan),(eve),(nonick);
 insert into lumen.profiles(user_id,nickname) values(ana,'Ana929'),(ben,'Ben929'),(cleo,'Cleo929'),(dan,'Dan929'),(eve,'Eve929');
 -- Accepted friendships (#35 edges, both directions).
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values
  (ana,ben,'friends'),(ben,ana,'friends'),(ana,eve,'friends'),(eve,ana,'friends');

 -- Accounts with a nickname only; guests are refused.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_circle_list();raise exception 'guest listed circles';
 exception when insufficient_privilege then if sqlerrm<>'account_required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',nonick::text,true);
 begin perform public.lumen_circle_create('Famille');raise exception 'no-nickname create';
 exception when insufficient_privilege then if sqlerrm<>'nickname_required' then raise;end if;end;
 assert not has_function_privilege('anon','public.lumen_circle_list()','execute'),'anon cannot call circle RPCs';
 assert not has_function_privilege('anon','public.lumen_circle_board(uuid,text,integer)','execute'),'anon cannot read a board';
 assert not has_table_privilege('authenticated','lumen.circles','select') and not has_table_privilege('authenticated','lumen.circle_members','select')
  and not has_table_privilege('anon','lumen.circle_links','select'),'no direct table access';

 -- Creation and names.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 begin perform public.lumen_circle_create(' x ');raise exception 'short name accepted';
 exception when invalid_parameter_value then if sqlerrm<>'circle_name_invalid' then raise;end if;end;
 begin perform public.lumen_circle_create('<script>');raise exception 'markup accepted';
 exception when invalid_parameter_value then if sqlerrm<>'circle_name_invalid' then raise;end if;end;
 x:=public.lumen_circle_create('  Famille   d''Ana ');
 circle:=(x->>'id')::uuid;
 assert x->>'name'='Famille d''Ana','name normalized';
 x:=public.lumen_circle_detail(circle);
 assert x->>'role'='owner' and jsonb_array_length(x->'members')=1,'creator is the owner';

 -- Outsider: no detail, board, members, rename, link, invite; same message as an unknown circle.
 perform set_config('request.jwt.claim.sub',dan::text,true);
 begin perform public.lumen_circle_detail(circle);raise exception 'outsider read detail';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 begin perform public.lumen_circle_detail(gen_random_uuid());raise exception 'unknown circle';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 select quest_id,grid_revision into q,rev from lumen_commands.quest_rules order by quest_id limit 1;
 begin perform public.lumen_circle_board(circle,q,rev);raise exception 'outsider read board';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 begin perform public.lumen_circle_rename(circle,'Pirate');raise exception 'outsider renamed';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 begin perform public.lumen_circle_link_create(circle);raise exception 'outsider created a link';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 begin perform public.lumen_circle_leave(circle);raise exception 'outsider left';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;
 assert jsonb_array_length(public.lumen_circle_list()->'circles')=0,'outsider lists nothing';

 -- Friend invitation: friends only, accepted.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 begin perform public.lumen_circle_invite_friend(circle,'Dan929');raise exception 'non-friend invited';
 exception when no_data_found then if sqlerrm<>'circle_friend_required' then raise;end if;end;
 begin perform public.lumen_circle_invite_friend(circle,'Nobody929');raise exception 'unknown invited';
 exception when no_data_found then if sqlerrm<>'circle_friend_required' then raise;end if;end;
 x:=public.lumen_circle_invite_friend(circle,' ben929 ');
 assert x->>'state'='pending','invitation pending';
 assert public.lumen_circle_invite_friend(circle,'Ben929')->>'state'='pending','re-invite is idempotent';
 assert public.lumen_circle_detail(circle)->'pending'=jsonb_build_array('Ben929'),'owner sees pending';
 perform set_config('request.jwt.claim.sub',ben::text,true);
 x:=public.lumen_circle_list();
 assert jsonb_array_length(x->'invitations')=1 and x->'invitations'->0->>'owner'='Ana929','invitee sees the invitation';
 inv:=(x->'invitations'->0->>'id')::uuid;
 -- Another account cannot answer it.
 perform set_config('request.jwt.claim.sub',dan::text,true);
 begin perform public.lumen_circle_respond(inv,true);raise exception 'foreign accept';
 exception when no_data_found then if sqlerrm<>'circle_invite_not_found' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',ben::text,true);
 assert public.lumen_circle_respond(inv,true)->>'state'='joined','friend joins';
 x:=public.lumen_circle_detail(circle);
 assert x->>'role'='member' and x->'pending' is null and x->'links' is null,'members do not see owner tools';
 -- Member permissions: no rename, delete, invite, link, removal.
 begin perform public.lumen_circle_rename(circle,'Ben');raise exception 'member renamed';
 exception when insufficient_privilege then if sqlerrm<>'circle_owner_required' then raise;end if;end;
 begin perform public.lumen_circle_delete(circle);raise exception 'member deleted';
 exception when insufficient_privilege then if sqlerrm<>'circle_owner_required' then raise;end if;end;
 begin perform public.lumen_circle_link_create(circle);raise exception 'member link';
 exception when insufficient_privilege then if sqlerrm<>'circle_owner_required' then raise;end if;end;
 begin perform public.lumen_circle_remove_member(circle,'Ana929');raise exception 'member removed owner';
 exception when insufficient_privilege then if sqlerrm<>'circle_owner_required' then raise;end if;end;

 -- Refusal: 24 h cooldown, then a new invitation is possible.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 perform public.lumen_circle_invite_friend(circle,'Eve929');
 perform set_config('request.jwt.claim.sub',eve::text,true);
 inv:=(public.lumen_circle_list()->'invitations'->0->>'id')::uuid;
 assert public.lumen_circle_respond(inv,false)->>'state'='declined','refused';
 assert jsonb_array_length(public.lumen_circle_list()->'invitations')=0,'refused invitation disappears';
 begin perform public.lumen_circle_respond(inv,true);raise exception 'accepted after refusal';
 exception when no_data_found then if sqlerrm<>'circle_invite_not_found' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',ana::text,true);
 begin perform public.lumen_circle_invite_friend(circle,'Eve929');raise exception 'cooldown ignored';
 exception when raise_exception then if sqlerrm<>'circle_invite_cooldown' then raise;end if;end;
 update lumen.circle_invites set declined_at=now()-interval '25 hours' where circle_id=circle and recipient_user_id=eve;
 assert public.lumen_circle_invite_friend(circle,'Eve929')->>'state'='pending','re-invite after 24 h';

 -- Links: created by the owner, shown once, preview reveals no member, join.
 x:=public.lumen_circle_link_create(circle);tok:=x->>'token';
 assert tok ~ '^[0-9a-f]{64}$' and (x->>'expires_at')::timestamptz between now()+interval '6 days 23 hours' and now()+interval '7 days 1 minute','7-day link';
 assert not exists(select 1 from lumen.circle_links where convert_from(token_hash,'LATIN1') like '%'||tok||'%'),'token not stored in clear';
 perform set_config('request.jwt.claim.sub',cleo::text,true);
 x:=public.lumen_circle_link_preview(tok);
 assert x->>'name'='Famille d''Ana' and x->>'owner'='Ana929' and (x->>'members')::int=2 and not (x->>'member')::boolean,'preview';
 assert x::text !~ 'Ben929','preview never lists members';
 assert public.lumen_circle_link_join(tok)->>'state'='joined','join by link';
 begin perform public.lumen_circle_link_join(tok);raise exception 'joined twice';
 exception when raise_exception then if sqlerrm<>'circle_already_member' then raise;end if;end;
 -- Revoked and expired links are useless and indistinguishable from unknown ones.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 link:=(public.lumen_circle_detail(circle)->'links'->0->>'id')::uuid;
 assert public.lumen_circle_link_revoke(circle,link),'revoked';
 x:=public.lumen_circle_link_create(circle);tok2:=x->>'token';
 update lumen.circle_links set expires_at=now()-interval '1 minute' where circle_id=circle and revoked_at is null;
 perform set_config('request.jwt.claim.sub',dan::text,true);
 foreach txt in array array[tok,tok2,repeat('0',64),'not-a-token'] loop
  begin perform public.lumen_circle_link_preview(txt);raise exception 'invalid link previewed';
  exception when no_data_found then if sqlerrm<>'circle_link_invalid' then raise;end if;end;
  begin perform public.lumen_circle_link_join(txt);raise exception 'invalid link joined';
  exception when no_data_found then if sqlerrm<>'circle_link_invalid' then raise;end if;end;
 end loop;
 assert not exists(select 1 from lumen.circle_members where circle_id=circle and user_id=dan),'outsider never joined';
 -- At most 3 active links.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 for i in 1..3 loop perform public.lumen_circle_link_create(circle);end loop;
 begin perform public.lumen_circle_link_create(circle);raise exception 'fourth link';
 exception when raise_exception then if sqlerrm<>'circle_link_limit' then raise;end if;end;

 -- Private ranking: official scores of members only, public tie rule, no virtual players.
 insert into lumen_commands.ranking_members(user_id,nickname,participating) values(ana,'Ana929',true),(ben,'Ben929',true),(cleo,'Cleo929',true),(dan,'Dan929',true)
  on conflict(user_id) do update set participating=true;
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values
  (ana,q,rev,90,5),(ben,q,rev,80,0),(dan,q,rev,10,0);
 public_before:=lumen_commands.ranking_board(q,rev);
 x:=public.lumen_circle_board(circle,q,rev);
 assert (x->>'members')::int=3 and (x->>'ranked')::int=2,'members counted, Cléo without time';
 assert x->'top'->0->>'nickname'='Ben929' and (x->'top'->0->>'place')::int=1 and x->'top'->1->>'nickname'='Ana929','ranked by official score';
 assert x::text !~ 'Dan929' and x::text !~ 'Écho','no outsider and no virtual player';
 assert (x->'personal'->>'place')::int=2 and (x->'personal'->>'mine')::boolean,'personal position';
 assert (x->'top'->1->>'score')::int=95,'official score includes penalties';
 -- The public board is unchanged by circles (same caller, same data).
 assert lumen_commands.ranking_board(q,rev)=public_before,'public ranking unchanged';
 update lumen_commands.ranking_scores set seconds=75 where user_id=ana and quest_id=q and grid_revision=rev;
 x:=public.lumen_circle_board(circle,q,rev);
 assert (x->'top'->0->>'place')::int=1 and (x->'top'->1->>'place')::int=1,'ties share a place';
 assert jsonb_array_length(public.lumen_circle_detail(circle)->'quests')>=1,'quests with member times listed';
 begin perform public.lumen_circle_board(circle,'not-a-quest',0);raise exception 'unknown quest';
 exception when invalid_parameter_value then if sqlerrm<>'circle_quest_invalid' then raise;end if;end;
 -- Removal by the owner; the removed member loses access.
 assert public.lumen_circle_remove_member(circle,'Cleo929'),'owner removes a member';
 perform set_config('request.jwt.claim.sub',cleo::text,true);
 begin perform public.lumen_circle_board(circle,q,rev);raise exception 'removed member read board';
 exception when no_data_found then if sqlerrm<>'circle_not_found' then raise;end if;end;

 -- Limits: 20 members per circle, 10 circles per player.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 extra:=array[]::uuid[];
 for i in 1..20 loop
  u:=('00000000-0000-4000-8000-0000009292'||lpad(i::text,2,'0'))::uuid;extra:=extra||u;
  insert into auth.users(id) values(u);insert into lumen.profiles(user_id,nickname) values(u,'Extra929n'||i);
 end loop;
 other:=(public.lumen_circle_create('Bureau')->>'id')::uuid;
 tok:=public.lumen_circle_link_create(other)->>'token';
 -- Ana + 19 players = 20 members; the 21st is refused.
 for i in 1..19 loop perform set_config('request.jwt.claim.sub',extra[i]::text,true);perform public.lumen_circle_link_join(tok);end loop;
 assert (select count(*) from lumen.circle_members where circle_id=other)=20,'20 members';
 perform set_config('request.jwt.claim.sub',extra[20]::text,true);
 begin perform public.lumen_circle_link_join(tok);raise exception '21st member accepted';
 exception when raise_exception then if sqlerrm<>'circle_full' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',dan::text,true);
 for i in 1..10 loop perform public.lumen_circle_create('Cercle '||i);end loop;
 begin perform public.lumen_circle_create('Onzième');raise exception 'eleventh circle';
 exception when raise_exception then if sqlerrm<>'circle_limit_reached' then raise;end if;end;

 -- Owner leaves: the oldest member becomes owner; last member leaving deletes the circle.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 assert public.lumen_circle_leave(circle),'owner leaves';
 perform set_config('request.jwt.claim.sub',ben::text,true);
 assert public.lumen_circle_detail(circle)->>'role'='owner','oldest member is the new owner';
 assert (select owner_user_id from lumen.circles where id=circle)=ben,'owner column follows';
 perform set_config('request.jwt.claim.sub',eve::text,true);
 perform public.lumen_circle_respond((public.lumen_circle_list()->'invitations'->0->>'id')::uuid,true);
 perform set_config('request.jwt.claim.sub',ben::text,true);
 assert public.lumen_circle_leave(circle);
 assert (select owner_user_id from lumen.circles where id=circle)=eve,'ownership transferred again';
 perform set_config('request.jwt.claim.sub',eve::text,true);
 assert public.lumen_circle_leave(circle);
 assert not exists(select 1 from lumen.circles where id=circle) and not exists(select 1 from lumen.circle_links where circle_id=circle)
  and not exists(select 1 from lumen.circle_invites where circle_id=circle),'empty circle deleted with its links and invitations';
 -- Owner deletes a circle: everything goes, members lose access.
 perform set_config('request.jwt.claim.sub',ana::text,true);
 assert public.lumen_circle_delete(other);
 assert not exists(select 1 from lumen.circle_members where circle_id=other),'members removed with the circle';

 -- Lumen erasure: the erased owner's circle passes to the next member.
 x:=public.lumen_circle_create('Effacement');other:=(x->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',ben::text,true);
 insert into lumen.circle_members(circle_id,user_id,role) values(other,ben,'member');
 perform set_config('request.jwt.claim.sub','',true); -- operator session
 perform lumen_privacy.erase_account(ana,array[]::text[],'ERASE LUMEN '||ana::text);
 assert (select owner_user_id from lumen.circles where id=other)=ben,'erasure transfers ownership';
 assert not exists(select 1 from lumen.circle_members where user_id=ana) and not exists(select 1 from lumen.circles where owner_user_id=ana),'erased owner fully removed';

 -- No email or user ID ever leaves the RPCs.
 perform set_config('request.jwt.claim.sub',ben::text,true);
 txt:=public.lumen_circle_list()::text||public.lumen_circle_detail(other)::text;
 assert txt !~ '@' and position(ben::text in txt)=0 and position(ana::text in txt)=0,'no email or user ID exposed';
 raise notice 'circles-929: ok';
end $$;
rollback;
