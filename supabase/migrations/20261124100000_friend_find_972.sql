-- #972: find friends by full or partial nickname (Espace social > Amis).
-- Additive and idempotent. #35 deliberately kept lumen_friend_search exact-only to
-- avoid enumerating players; this separate, bounded RPC opens partial search with
-- explicit anti-enumeration guards, as requested by the owner in #972:
--  * accounts with a chosen nickname only (lumen.social_caller), self excluded;
--  * at least 3 letters/digits after normalisation, at most 20 characters;
--  * case- and accent-insensitive (fixed translate() fold: no extension needed);
--  * 8 results per page, at most 3 pages (24 nicknames per query);
--  * 60 searches per account per rolling hour (one budget row per account);
--  * returns only the public nickname and the caller's own relation state,
--    never an email, a user ID or any other profile data.
-- Ordering: exact match, then prefix, then contains; shorter nicknames first.
-- Free-first: one RPC per explicit search (the client debounces and requires 3
-- characters); no new index while lumen.profiles stays small (a seq scan of a
-- few thousand short rows), see docs/UX_AND_VISUAL_DIRECTION.md #972.
begin;

create table if not exists lumen.social_search_budget(
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default now(),
 searches integer not null default 0 check(searches>=0)
);
alter table lumen.social_search_budget enable row level security;
revoke all on lumen.social_search_budget from public,anon,authenticated,service_role;

create or replace function lumen.social_fold(p_value text) returns text
language sql immutable parallel safe set search_path='' as $$
 select translate(lower(btrim(regexp_replace(coalesce(p_value,''),'\s+',' ','g'))),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿāăąćĉċčďēĕėęěĝğġģĥĩīĭįĳĵķĺļľŀńņňōŏőŕŗřśŝşšţťũūŭůűųŵŷźżžſơưǆǉǌǎǐǒǔǖǘǚǜǟǡǧǩǫǭǰǳǵǹǻȁȃȅȇȉȋȍȏȑȓȕȗșțȟȧȩȫȭȯȱȳ',
  'aaaaaaceeeeiiiinooooouuuuyyaaaccccdeeeeegggghiiiiijkllllnnnooorrrssssttuuuuuuwyzzzsoudlnaiouuuuuaagkoojdgnaaaeeiioorruusthaeooooy')
$$;
revoke all on function lumen.social_fold(text) from public,anon,authenticated,service_role;

create or replace function public.lumen_friend_find(p_query text,p_page integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 me uuid:=lumen.social_caller();
 q text:=lumen.social_fold(p_query);
 page integer:=coalesce(p_page,0);
 used integer;
 found jsonb;
 total integer;
begin
 if char_length(regexp_replace(q,'[^[:alnum:]]','','g'))<3 then raise exception 'query_too_short';end if;
 if char_length(q)>20 then raise exception 'query_too_long';end if;
 if page<0 or page>2 then raise exception 'invalid_page';end if;
 insert into lumen.social_search_budget as b(user_id,window_start,searches) values(me,now(),1)
  on conflict(user_id) do update set
   window_start=case when b.window_start<=now()-interval '1 hour' then now() else b.window_start end,
   searches=case when b.window_start<=now()-interval '1 hour' then 1 else b.searches+1 end
  returning searches into used;
 if used>60 then raise exception 'search_rate_limited';end if;
 with candidates as (
  select btrim(p.nickname) as nickname,lumen.social_fold(p.nickname) as folded,p.user_id
  from lumen.profiles p
  where p.nickname_ready and p.user_id<>me and strpos(lumen.social_fold(p.nickname),q)>0
 ),ranked as (
  select c.nickname,
   case when c.folded=q then 0 when left(c.folded,char_length(q))=q then 1 else 2 end as tier,
   coalesce((select case when e.state='declined' then 'none' else e.state end
     from lumen.social_friend_edges e where e.user_id=me and e.friend_user_id=c.user_id),'none') as state,
   row_number() over(order by case when c.folded=q then 0 when left(c.folded,char_length(q))=q then 1 else 2 end,
     char_length(c.nickname),c.folded,c.nickname) as n
  from candidates c
 )
 select coalesce(jsonb_agg(jsonb_build_object('nickname',r.nickname,'state',r.state) order by r.n)
   filter(where r.n>page*8 and r.n<=page*8+8),'[]'::jsonb),count(*)::integer
  into found,total from ranked r;
 return jsonb_build_object('results',found,'page',page,'more',page<2 and total>page*8+8);
end $$;
revoke all on function public.lumen_friend_find(text,integer) from public,anon;
grant execute on function public.lumen_friend_find(text,integer) to authenticated;

-- Lumen erasure removes the caller's budget row (same pattern as #35/#948).
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null and to_regprocedure('lumen_privacy.policy_before_friend_find()') is null then
  alter function lumen_privacy.policy() rename to policy_before_friend_find;
  execute $f$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_friend_find()
    union all values ('lumen','social_search_budget','user_id',null::text,null::text,'delete')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_friend_find() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;

notify pgrst,'reload schema';
commit;
