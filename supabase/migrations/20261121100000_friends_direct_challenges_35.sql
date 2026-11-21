-- #35 (EPIC #881, Lot 2 PR B): optional friends and direct challenges.
-- Additive and idempotent. Accounts only (guests keep link challenges).
-- Public identity = the existing unique nickname (lumen.profiles); no email,
-- user ID or other personal data ever leaves these RPCs.
-- Privacy model: every row has exactly one owner, so Lumen erasure removes a
-- player's rows without touching another player's data (no shared rows):
--  * lumen.social_friend_edges: one directed edge per player and relation;
--  * lumen.social_challenge_invites: owned by the recipient; the sender is the
--    existing (anonymizable) challenge sender, never copied here, and there is
--    deliberately no foreign key to lumen.social_challenges (erasure review).
begin;

create table if not exists lumen.social_friend_edges(
 user_id uuid not null references auth.users(id) on delete cascade,
 friend_user_id uuid not null references auth.users(id) on delete cascade,
 state text not null check(state in ('outgoing','incoming','friends','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,friend_user_id),
 check(user_id<>friend_user_id)
);
create index if not exists social_friend_edges_friend_idx on lumen.social_friend_edges(friend_user_id);
alter table lumen.social_friend_edges enable row level security;
revoke all on lumen.social_friend_edges from public,anon,authenticated,service_role;

create table if not exists lumen.social_challenge_invites(
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(challenge_id,recipient_user_id)
);
create index if not exists social_challenge_invites_recipient_idx on lumen.social_challenge_invites(recipient_user_id,created_at desc);
create index if not exists social_challenge_invites_challenge_idx on lumen.social_challenge_invites(challenge_id);
alter table lumen.social_challenge_invites enable row level security;
revoke all on lumen.social_challenge_invites from public,anon,authenticated,service_role;

-- When a profile disappears (Lumen erasure), other players' edges towards it go too.
create or replace function lumen.social_forget_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from lumen.social_friend_edges where friend_user_id=old.user_id;
 return old;
end $$;
revoke all on function lumen.social_forget_profile() from public,anon,authenticated,service_role;
drop trigger if exists lumen_social_forget_profile on lumen.profiles;
create trigger lumen_social_forget_profile after delete on lumen.profiles for each row execute function lumen.social_forget_profile();

-- Caller with a chosen public nickname; never a guest.
create or replace function lumen.social_caller() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is null then raise exception using errcode='42501',message='account_required';end if;
 if not exists(select 1 from lumen.profiles p where p.user_id=me and p.nickname_ready) then
  raise exception using errcode='42501',message='nickname_required';end if;
 return me;
end $$;
create or replace function lumen.social_player(p_nickname text) returns uuid
language sql stable security definer set search_path='' as $$
 select p.user_id from lumen.profiles p where p.nickname_ready and lower(btrim(p.nickname))=lower(btrim(coalesce(p_nickname,'')));
$$;
revoke all on function lumen.social_caller(),lumen.social_player(text) from public,anon,authenticated,service_role;

-- Exact nickname only: no partial search, so no enumeration of players.
create or replace function public.lumen_friend_search(p_nickname text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();target uuid:=lumen.social_player(p_nickname);edge text;
begin
 if target is null or target=me then return null;end if;
 select e.state into edge from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=target;
 return jsonb_build_object('nickname',(select btrim(p.nickname) from lumen.profiles p where p.user_id=target),
  'state',case when edge is null or edge='declined' then 'none' else edge end);
end $$;

create or replace function public.lumen_friend_request(p_nickname text) returns text
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();target uuid:=lumen.social_player(p_nickname);mine record;
begin
 if target is null then raise exception 'player_not_found';end if;
 if target=me then raise exception 'cannot_add_self';end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-friend:'||least(me,target)::text||greatest(me,target)::text,0));
 select * into mine from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=target;
 if mine.state='friends' or mine.state='outgoing' then return mine.state;end if;
 if mine.state='incoming' then
  update lumen.social_friend_edges set state='friends',updated_at=now() where (user_id=me and friend_user_id=target) or (user_id=target and friend_user_id=me);
  return 'friends';
 end if;
 -- Anti-spam: a declined request waits 30 days; few pending and daily requests.
 if mine.state='declined' and mine.updated_at>now()-interval '30 days' then raise exception 'request_cooldown';end if;
 if (select count(*) from lumen.social_friend_edges e where e.user_id=me and e.state='outgoing')>=30 then raise exception 'too_many_pending';end if;
 if (select count(*) from lumen.social_friend_edges e where e.user_id=me and e.state='outgoing' and e.updated_at>now()-interval '1 day')>=10 then raise exception 'rate_limited';end if;
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values(me,target,'outgoing')
  on conflict(user_id,friend_user_id) do update set state='outgoing',updated_at=now();
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values(target,me,'incoming')
  on conflict(user_id,friend_user_id) do update set state='incoming',updated_at=now();
 return 'outgoing';
end $$;

create or replace function public.lumen_friend_respond(p_nickname text,p_accept boolean) returns text
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();target uuid:=lumen.social_player(p_nickname);
begin
 if target is null then raise exception 'player_not_found';end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-friend:'||least(me,target)::text||greatest(me,target)::text,0));
 if not exists(select 1 from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=target and e.state='incoming') then
  raise exception 'no_pending_request';end if;
 if coalesce(p_accept,false) then
  update lumen.social_friend_edges set state='friends',updated_at=now() where (user_id=me and friend_user_id=target) or (user_id=target and friend_user_id=me);
  return 'friends';
 end if;
 -- Decline quietly: the requester's edge becomes a 30-day cooldown, never a notification.
 delete from lumen.social_friend_edges where user_id=me and friend_user_id=target;
 update lumen.social_friend_edges set state='declined',updated_at=now() where user_id=target and friend_user_id=me;
 return 'declined';
end $$;

-- Remove a friend or cancel one's own pending request (both edges go).
create or replace function public.lumen_friend_remove(p_nickname text) returns text
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();target uuid:=lumen.social_player(p_nickname);
begin
 if target is null then raise exception 'player_not_found';end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-friend:'||least(me,target)::text||greatest(me,target)::text,0));
 if not exists(select 1 from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=target and e.state in ('friends','outgoing')) then
  raise exception 'not_related';end if;
 delete from lumen.social_friend_edges where (user_id=me and friend_user_id=target) or (user_id=target and friend_user_id=me and state<>'declined');
 return 'removed';
end $$;

create or replace function public.lumen_friend_list() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('nickname',btrim(p.nickname),'state',e.state,'since',e.updated_at)
  order by case e.state when 'incoming' then 0 when 'friends' then 1 else 2 end,lower(p.nickname)),'[]')
 from lumen.social_friend_edges e join lumen.profiles p on p.user_id=e.friend_user_id and p.nickname_ready
 where e.user_id=lumen.social_caller() and e.state<>'declined';
$$;

-- Direct challenge: an existing challenge of mine, sent to an accepted friend.
-- The challenge itself was created by the #889 qualifying-run writer; there is
-- no second qualification or challenge engine here.
create or replace function public.lumen_challenge_send_to_friend(p_challenge_id uuid,p_nickname text) returns text
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();target uuid:=lumen.social_player(p_nickname);
begin
 if not exists(select 1 from lumen.social_challenges c where c.id=p_challenge_id and c.sender_user_id=me) then raise exception 'not_challenge_owner';end if;
 if target is null or not exists(select 1 from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=target and e.state='friends') then
  raise exception 'not_friends';end if;
 if exists(select 1 from lumen.social_challenge_invites i where i.challenge_id=p_challenge_id and i.recipient_user_id=target) then return 'already_sent';end if;
 if (select count(*) from lumen.social_challenge_invites i join lumen.social_challenges c on c.id=i.challenge_id
     where c.sender_user_id=me and i.created_at>now()-interval '1 day')>=30 then raise exception 'rate_limited';end if;
 insert into lumen.social_challenge_invites(challenge_id,recipient_user_id) values(p_challenge_id,target) on conflict do nothing;
 return 'sent';
end $$;

-- Inbox: received direct challenges (my own participation only, reference hidden
-- as in lumen_get_social_challenge) and sent ones with each friend's status.
create or replace function public.lumen_challenge_inbox() returns jsonb
language sql stable security definer set search_path='' as $$
 with me as (select lumen.social_caller() id)
 select jsonb_build_object(
  'received',coalesce((select jsonb_agg(jsonb_build_object('challenge_id',c.id,'sender',coalesce(btrim(sp.nickname),c.sender_display_name),
    'puzzle_id',c.puzzle_id,'stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,'source_first_play',c.source_first_play,
    'created_at',i.created_at,'status',coalesce(pp.status,'pending')) order by i.created_at desc)
   from me join lumen.social_challenge_invites i on i.recipient_user_id=me.id
   join lumen.social_challenges c on c.id=i.challenge_id
   left join lumen.profiles sp on sp.user_id=c.sender_user_id and sp.nickname_ready
   left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1
   left join lumen.social_challenge_participations pp on pp.challenge_id=c.id and pp.participant_key='u:'||me.id::text),'[]'),
  'sent',coalesce((select jsonb_agg(jsonb_build_object('challenge_id',c.id,'recipient',coalesce(btrim(rp.nickname),'Joueur'),
    'puzzle_id',c.puzzle_id,'stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
    'created_at',i.created_at,'status',coalesce(pp.status,'pending'),
    'duration_seconds',case when pp.status in ('completed','abandoned') then pp.duration_seconds end) order by i.created_at desc)
   from me join lumen.social_challenges c on c.sender_user_id=me.id
   join lumen.social_challenge_invites i on i.challenge_id=c.id
   left join lumen.profiles rp on rp.user_id=i.recipient_user_id and rp.nickname_ready
   left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1
   left join lumen.social_challenge_participations pp on pp.challenge_id=c.id and pp.participant_key='u:'||i.recipient_user_id::text),'[]'));
$$;

revoke all on function public.lumen_friend_search(text),public.lumen_friend_request(text),public.lumen_friend_respond(text,boolean),
 public.lumen_friend_remove(text),public.lumen_friend_list(),public.lumen_challenge_send_to_friend(uuid,text),public.lumen_challenge_inbox() from public,anon;
grant execute on function public.lumen_friend_search(text),public.lumen_friend_request(text),public.lumen_friend_respond(text,boolean),
 public.lumen_friend_remove(text),public.lumen_friend_list(),public.lumen_challenge_send_to_friend(uuid,text),public.lumen_challenge_inbox() to authenticated;

-- Register both tables for Lumen erasure (same pattern as #729/#796).
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null and to_regprocedure('lumen_privacy.policy_before_social_friends()') is null then
  alter function lumen_privacy.policy() rename to policy_before_social_friends;
  execute $f$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_social_friends()
    union all values ('lumen','social_challenge_invites','recipient_user_id',null::text,null::text,'delete'),
     ('lumen','social_friend_edges','user_id',null,null,'delete')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_social_friends() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;

notify pgrst,'reload schema';
commit;
