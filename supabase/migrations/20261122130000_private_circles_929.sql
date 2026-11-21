-- #929 (EPIC #928, V1): private circles, invitations and private rankings.
-- Additive and idempotent. Accounts with a chosen nickname only.
--
-- Product decisions (owner, 2026-11-21): up to 20 members per circle and 10
-- circles per player (owned or joined); invite links valid 7 days, revocable,
-- at most 3 active per circle; at most 20 pending friend invitations per
-- circle, none re-sent for 24 h after a refusal; owner leaving -> oldest member
-- becomes owner; last member leaving deletes the circle. Names 2-30 chars,
-- same character rule as nicknames (plus apostrophes).
--
-- Privacy model (same as #35): every row has exactly one owner and there is no
-- foreign key between Lumen tables, so Lumen erasure removes a player's rows
-- without touching anyone else's; triggers keep circles consistent:
--  * lumen.circles          owner_user_id (the current owner)
--  * lumen.circle_members   user_id       (each member's own membership)
--  * lumen.circle_invites   recipient_user_id (the invited friend)
--  * lumen.circle_links     created_by    (only a SHA-256 of the token is kept)
-- Tables: RLS on, no direct grant; every access goes through the account-only
-- RPCs below. Public identity = the existing unique nickname; no email, user
-- ID or other personal data ever leaves these RPCs. Rankings reuse the
-- official scores (lumen_commands.ranking_scores, same tie rule as the public
-- board, no virtual players); the public board is unchanged.
begin;

create table if not exists lumen.circles(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 2 and 30),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists lumen.circle_members(
 circle_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','member')),
 joined_at timestamptz not null default clock_timestamp(),
 primary key(circle_id,user_id)
);
create index if not exists circle_members_user_idx on lumen.circle_members(user_id);
create unique index if not exists circle_members_one_owner on lumen.circle_members(circle_id) where role='owner';
create table if not exists lumen.circle_invites(
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 declined_at timestamptz,
 unique(circle_id,recipient_user_id)
);
create index if not exists circle_invites_recipient_idx on lumen.circle_invites(recipient_user_id);
create table if not exists lumen.circle_links(
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null,
 token_hash bytea not null unique,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create index if not exists circle_links_circle_idx on lumen.circle_links(circle_id);
do $$declare t text;begin
 foreach t in array array['circles','circle_members','circle_invites','circle_links'] loop
  execute format('alter table lumen.%I enable row level security',t);
  execute format('revoke all on lumen.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

-- Consistency without cross-table foreign keys.
create or replace function lumen.circle_member_gone() returns trigger
language plpgsql security definer set search_path='' as $$
declare heir uuid;
begin
 if not exists(select 1 from lumen.circles where id=old.circle_id) then return old;end if;
 if not exists(select 1 from lumen.circle_members where circle_id=old.circle_id) then
  delete from lumen.circles where id=old.circle_id;
 elsif old.role='owner' then
  select user_id into heir from lumen.circle_members where circle_id=old.circle_id order by joined_at,user_id limit 1;
  update lumen.circle_members set role='owner' where circle_id=old.circle_id and user_id=heir;
  update lumen.circles set owner_user_id=heir,updated_at=now() where id=old.circle_id;
 end if;
 return old;
end $$;
create or replace function lumen.circle_gone() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from lumen.circle_members where circle_id=old.id;
 delete from lumen.circle_invites where circle_id=old.id;
 delete from lumen.circle_links where circle_id=old.id;
 return old;
end $$;
revoke all on function lumen.circle_member_gone(),lumen.circle_gone() from public,anon,authenticated,service_role;
drop trigger if exists lumen_circle_member_gone on lumen.circle_members;
create trigger lumen_circle_member_gone after delete on lumen.circle_members for each row execute function lumen.circle_member_gone();
drop trigger if exists lumen_circle_gone on lumen.circles;
create trigger lumen_circle_gone after delete on lumen.circles for each row execute function lumen.circle_gone();

-- Private helpers.
create or replace function lumen.circle_name(p_name text) returns text
language plpgsql immutable set search_path='' as $$
declare v text:=btrim(regexp_replace(coalesce(p_name,''),'\s+',' ','g'));
begin
 if char_length(v) not between 2 and 30 or v !~ '^[[:alnum:]][[:alnum:] _.''’-]*$' then
  raise exception using errcode='22023',message='circle_name_invalid';end if;
 return v;
end $$;
-- A non-member learns nothing: unknown and foreign circles look the same.
create or replace function lumen.circle_role(p_circle uuid,p_user uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 select role into r from lumen.circle_members where circle_id=p_circle and user_id=p_user;
 if r is null then raise exception using errcode='P0002',message='circle_not_found';end if;
 return r;
end $$;
create or replace function lumen.circle_owner_only(p_circle uuid,p_user uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if lumen.circle_role(p_circle,p_user)<>'owner' then raise exception using errcode='42501',message='circle_owner_required';end if;
end $$;
create or replace function lumen.circle_room(p_user uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if (select count(*) from lumen.circle_members where user_id=p_user)>=10 then
  raise exception using errcode='P0001',message='circle_limit_reached';end if;
end $$;
create or replace function lumen.circle_join(p_circle uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle:'||p_circle::text,0));
 if exists(select 1 from lumen.circle_members where circle_id=p_circle and user_id=p_user) then
  raise exception using errcode='P0001',message='circle_already_member';end if;
 perform lumen.circle_room(p_user);
 if (select count(*) from lumen.circle_members where circle_id=p_circle)>=20 then
  raise exception using errcode='P0001',message='circle_full';end if;
 insert into lumen.circle_members(circle_id,user_id,role) values(p_circle,p_user,'member');
 delete from lumen.circle_invites where circle_id=p_circle and recipient_user_id=p_user;
end $$;
create or replace function lumen.circle_nick(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
 select btrim(nickname) from lumen.profiles where user_id=p_user and nickname_ready;
$$;
revoke all on function lumen.circle_name(text),lumen.circle_role(uuid,uuid),lumen.circle_owner_only(uuid,uuid),
 lumen.circle_room(uuid),lumen.circle_join(uuid,uuid),lumen.circle_nick(uuid) from public,anon,authenticated,service_role;

-- Player RPCs (accounts with a nickname; lumen.social_caller enforces it).
create or replace function public.lumen_circle_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();
begin
 return jsonb_build_object(
  'circles',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',m.role,
    'members',(select count(*) from lumen.circle_members x where x.circle_id=c.id)) order by m.joined_at desc)
   from lumen.circle_members m join lumen.circles c on c.id=m.circle_id where m.user_id=me),'[]'),
  'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',c.name,'owner',lumen.circle_nick(c.owner_user_id),
    'members',(select count(*) from lumen.circle_members x where x.circle_id=c.id)) order by i.created_at desc)
   from lumen.circle_invites i join lumen.circles c on c.id=i.circle_id where i.recipient_user_id=me and i.declined_at is null),'[]'),
  'limits',jsonb_build_object('circles',10,'members',20,'linkDays',7));
end $$;

create or replace function public.lumen_circle_create(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();v text:=lumen.circle_name(p_name);created uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle-user:'||me::text,0));
 perform lumen.circle_room(me);
 insert into lumen.circles(name,owner_user_id) values(v,me) returning id into created;
 insert into lumen.circle_members(circle_id,user_id,role) values(created,me,'owner');
 return jsonb_build_object('id',created,'name',v);
end $$;

create or replace function public.lumen_circle_rename(p_circle uuid,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();v text:=lumen.circle_name(p_name);
begin
 perform lumen.circle_owner_only(p_circle,me);
 update lumen.circles set name=v,updated_at=now() where id=p_circle;
 return jsonb_build_object('id',p_circle,'name',v);
end $$;

create or replace function public.lumen_circle_delete(p_circle uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();
begin
 perform lumen.circle_owner_only(p_circle,me);
 delete from lumen.circles where id=p_circle;
 return true;
end $$;

create or replace function public.lumen_circle_leave(p_circle uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();
begin
 perform lumen.circle_role(p_circle,me);
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle:'||p_circle::text,0));
 delete from lumen.circle_members where circle_id=p_circle and user_id=me;
 return true;
end $$;

create or replace function public.lumen_circle_remove_member(p_circle uuid,p_nickname text) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();them uuid:=lumen.social_player(p_nickname);
begin
 perform lumen.circle_owner_only(p_circle,me);
 if them is null or them=me or not exists(select 1 from lumen.circle_members where circle_id=p_circle and user_id=them) then
  raise exception using errcode='P0002',message='circle_member_not_found';end if;
 delete from lumen.circle_members where circle_id=p_circle and user_id=them;
 return true;
end $$;

create or replace function public.lumen_circle_detail(p_circle uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();my_role text:=lumen.circle_role(p_circle,me);
begin
 return jsonb_build_object('id',p_circle,'name',(select name from lumen.circles where id=p_circle),'role',my_role,
  'members',coalesce((select jsonb_agg(jsonb_build_object('nickname',coalesce(lumen.circle_nick(m.user_id),'Joueur'),'role',m.role,'me',m.user_id=me)
    order by m.role='owner' desc,m.joined_at) from lumen.circle_members m where m.circle_id=p_circle),'[]'),
  -- Owner tools only.
  'pending',case when my_role='owner' then coalesce((select jsonb_agg(coalesce(lumen.circle_nick(i.recipient_user_id),'Joueur') order by i.created_at)
    from lumen.circle_invites i where i.circle_id=p_circle and i.declined_at is null),'[]') end,
  'links',case when my_role='owner' then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'expires_at',l.expires_at) order by l.created_at)
    from lumen.circle_links l where l.circle_id=p_circle and l.revoked_at is null and l.expires_at>now()),'[]') end,
  -- Quests where at least one member has an official ranked time.
  'quests',coalesce((select jsonb_agg(jsonb_build_object('quest_id',q.quest_id,'grid_revision',q.grid_revision,'players',q.players)
    order by q.players desc,q.quest_id) from (
    select s.quest_id,s.grid_revision,count(*) players from lumen_commands.ranking_scores s
    join lumen.circle_members m on m.user_id=s.user_id and m.circle_id=p_circle
    join lumen.profiles p on p.user_id=s.user_id and p.nickname_ready and not p.ranking_opted_out
    group by s.quest_id,s.grid_revision order by count(*) desc,s.quest_id limit 60) q),'[]'));
end $$;

create or replace function public.lumen_circle_invite_friend(p_circle uuid,p_nickname text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();them uuid:=lumen.social_player(p_nickname);prior timestamptz;
begin
 perform lumen.circle_owner_only(p_circle,me);
 -- Only an accepted Lumen friend (#35); anyone else is refused the same way.
 if them is null or them=me or not exists(select 1 from lumen.social_friend_edges where user_id=me and friend_user_id=them and state='friends') then
  raise exception using errcode='P0002',message='circle_friend_required';end if;
 if exists(select 1 from lumen.circle_members where circle_id=p_circle and user_id=them) then
  raise exception using errcode='P0001',message='circle_already_member';end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle:'||p_circle::text,0));
 select declined_at into prior from lumen.circle_invites where circle_id=p_circle and recipient_user_id=them;
 if prior is not null and prior>now()-interval '24 hours' then raise exception using errcode='P0001',message='circle_invite_cooldown';end if;
 if found and prior is null then return jsonb_build_object('state','pending');end if;
 if (select count(*) from lumen.circle_invites where circle_id=p_circle and declined_at is null)>=20 then
  raise exception using errcode='P0001',message='circle_invite_limit';end if;
 insert into lumen.circle_invites(circle_id,recipient_user_id) values(p_circle,them)
  on conflict(circle_id,recipient_user_id) do update set created_at=now(),declined_at=null;
 return jsonb_build_object('state','pending');
end $$;

create or replace function public.lumen_circle_respond(p_invite uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();inv lumen.circle_invites;
begin
 select * into inv from lumen.circle_invites where id=p_invite and recipient_user_id=me and declined_at is null;
 if not found then raise exception using errcode='P0002',message='circle_invite_not_found';end if;
 if coalesce(p_accept,false) then
  perform lumen.circle_join(inv.circle_id,me);
  return jsonb_build_object('state','joined','id',inv.circle_id);
 end if;
 update lumen.circle_invites set declined_at=now() where id=inv.id;
 return jsonb_build_object('state','declined');
end $$;

create or replace function public.lumen_circle_link_create(p_circle uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();token text;expires timestamptz:=now()+interval '7 days';
begin
 perform lumen.circle_owner_only(p_circle,me);
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle:'||p_circle::text,0));
 if (select count(*) from lumen.circle_links where circle_id=p_circle and revoked_at is null and expires_at>now())>=3 then
  raise exception using errcode='P0001',message='circle_link_limit';end if;
 -- 244 random bits, shown once; only its digest is stored.
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into lumen.circle_links(circle_id,token_hash,created_by,expires_at) values(p_circle,sha256(convert_to(token,'UTF8')),me,expires);
 return jsonb_build_object('token',token,'expires_at',expires);
end $$;

create or replace function public.lumen_circle_link_revoke(p_circle uuid,p_link uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();
begin
 perform lumen.circle_owner_only(p_circle,me);
 update lumen.circle_links set revoked_at=now() where id=p_link and circle_id=p_circle and revoked_at is null;
 return found;
end $$;

-- A link reveals only the circle name, its owner and its size, and only while
-- valid; unknown, expired and revoked links are indistinguishable.
create or replace function lumen.circle_link_circle(p_token text) returns uuid
language sql stable security definer set search_path='' as $$
 select l.circle_id from lumen.circle_links l
 where l.token_hash=sha256(convert_to(coalesce(p_token,''),'UTF8')) and l.revoked_at is null and l.expires_at>now();
$$;
revoke all on function lumen.circle_link_circle(text) from public,anon,authenticated,service_role;
create or replace function public.lumen_circle_link_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();c uuid:=lumen.circle_link_circle(p_token);
begin
 if c is null then raise exception using errcode='P0002',message='circle_link_invalid';end if;
 return jsonb_build_object('name',(select name from lumen.circles where id=c),'owner',lumen.circle_nick((select owner_user_id from lumen.circles where id=c)),
  'members',(select count(*) from lumen.circle_members where circle_id=c),
  'member',exists(select 1 from lumen.circle_members where circle_id=c and user_id=me));
end $$;
create or replace function public.lumen_circle_link_join(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();c uuid:=lumen.circle_link_circle(p_token);
begin
 if c is null then raise exception using errcode='P0002',message='circle_link_invalid';end if;
 perform lumen.circle_join(c,me);
 return jsonb_build_object('state','joined','id',c);
end $$;

-- Private ranking: official ranked scores of members only, public tie rule,
-- no virtual players; members without a time are counted, never invented.
create or replace function public.lumen_circle_board(p_circle uuid,p_quest_id text,p_grid_revision integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();result jsonb;
begin
 perform lumen.circle_role(p_circle,me);
 if not exists(select 1 from lumen_commands.quest_rules where quest_id=p_quest_id and grid_revision=p_grid_revision) then
  raise exception using errcode='22023',message='circle_quest_invalid';end if;
 with members as (select m.user_id from lumen.circle_members m where m.circle_id=p_circle),
 scored as (
  select s.user_id,btrim(p.nickname) nickname,s.score,s.user_id=me mine from lumen_commands.ranking_scores s
  join members using(user_id) join lumen.profiles p using(user_id)
  where s.quest_id=p_quest_id and s.grid_revision=p_grid_revision and p.nickname_ready and not p.ranking_opted_out
 ), ranked as (
  select *,rank() over(order by score) place,row_number() over(order by score,nickname collate "C") position from scored
 ), packed as (
  select position,mine,jsonb_build_object('nickname',nickname,'score',score,'mine',mine,'place',place,'position',position) row from ranked
 ) select jsonb_build_object('quest_id',p_quest_id,'grid_revision',p_grid_revision,
   'members',(select count(*) from members),'ranked',(select count(*) from scored),
   'top',coalesce((select jsonb_agg(row order by position) from packed where position<=3),'[]'),
   'personal',(select row from packed where mine)) into result;
 return result;
end $$;

do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'lumen\_circle\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon',f);
  execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;

-- Register the four tables for Lumen erasure (same pattern as #35).
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null and to_regprocedure('lumen_privacy.policy_before_circles_929()') is null then
  alter function lumen_privacy.policy() rename to policy_before_circles_929;
  execute $f$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_circles_929()
    union all values ('lumen','circles','owner_user_id',null::text,null::text,'delete'),
     ('lumen','circle_members','user_id',null,null,'delete'),
     ('lumen','circle_invites','recipient_user_id',null,null,'delete'),
     ('lumen','circle_links','created_by',null,null,'delete')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_circles_929() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;

notify pgrst,'reload schema';
commit;
