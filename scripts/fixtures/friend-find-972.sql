-- #972: partial, case- and accent-insensitive friend search with anti-enumeration
-- guards, on the real migrated schema. Disposable fixture: invented identities, rolled back.
begin;
do $$
declare
 alice constant uuid:='00000000-0000-4000-8000-000000972001';
 bruno constant uuid:='00000000-0000-4000-8000-000000972002';
 berenice constant uuid:='00000000-0000-4000-8000-000000972003';
 hidden constant uuid:='00000000-0000-4000-8000-000000972004';
 exact constant uuid:='00000000-0000-4000-8000-000000972005';
 nonick constant uuid:='00000000-0000-4000-8000-000000972006';
 spammer constant uuid:='00000000-0000-4000-8000-000000972007';
 x jsonb;names text[];i integer;star uuid;
begin
 insert into auth.users(id) values(alice),(bruno),(berenice),(hidden),(exact),(nonick),(spammer);
 insert into lumen.profiles(user_id,nickname,nickname_ready) values
  (alice,'Alice972',true),(bruno,'Bruno972',true),(berenice,'Bérénice972',true),
  (exact,'Bru972',true),(spammer,'Spam972',true);
 insert into lumen.profiles(user_id,nickname) values(nonick,'');
 -- An unresolved historical duplicate (nickname not ready) is never searchable.
 alter table lumen.profiles disable trigger lumen_nickname_guard;
 insert into lumen.profiles(user_id,nickname,nickname_ready) values(hidden,'Brunette972',false);
 alter table lumen.profiles enable trigger lumen_nickname_guard;

 -- Accounts with a chosen nickname only.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_friend_find('bru');raise exception 'guest searched';
 exception when insufficient_privilege then if sqlerrm<>'account_required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',nonick::text,true);
 begin perform public.lumen_friend_find('bru');raise exception 'no-nickname search';
 exception when insufficient_privilege then if sqlerrm<>'nickname_required' then raise;end if;end;

 -- Minimal input: 3 letters/digits after normalisation; bounded length and pages.
 perform set_config('request.jwt.claim.sub',alice::text,true);
 foreach x in array array['"br"','"  b r "','"--."']::jsonb[] loop
  begin perform public.lumen_friend_find(x#>>'{}');raise exception 'short query accepted: %',x;
  exception when raise_exception then if sqlerrm<>'query_too_short' then raise;end if;end;
 end loop;
 begin perform public.lumen_friend_find(repeat('a',21));raise exception 'long query accepted';
 exception when raise_exception then if sqlerrm<>'query_too_long' then raise;end if;end;
 begin perform public.lumen_friend_find('bru',3);raise exception 'page 4 accepted';
 exception when raise_exception then if sqlerrm<>'invalid_page' then raise;end if;end;
 assert (select searches from lumen.social_search_budget where user_id=alice) is null,'rejected input costs no budget';

 -- Exact, then prefix, then contains; case-insensitive; hidden profiles and self excluded.
 x:=public.lumen_friend_find('BRU972');
 assert x->'results'=jsonb_build_array(jsonb_build_object('nickname','Bru972','state','none')),'exact match: '||x::text;
 x:=public.lumen_friend_find('bru');
 select array_agg(r->>'nickname' order by o) into names from jsonb_array_elements(x->'results') with ordinality as t(r,o);
 assert names=array['Bru972','Bruno972'],'prefix matches, shorter first, no hidden profile: '||x::text;
 x:=public.lumen_friend_find('972');
 assert not (x->'results')::text ~ 'Alice972','the caller is never a result';
 assert jsonb_array_length(x->'results')=4 and x->>'more'='false','contains: '||x::text;
 -- Accents: both directions, any case.
 assert public.lumen_friend_find('berenice')->'results'->0->>'nickname'='Bérénice972','unaccented query finds the accented nickname';
 assert public.lumen_friend_find('BÉRÉ')->'results'->0->>'nickname'='Bérénice972','accented capitals fold too';
 assert public.lumen_friend_find('ICE97')->'results'->0->>'nickname'='Bérénice972','fragment inside the nickname';
 assert public.lumen_friend_find('zzz972')->'results'='[]'::jsonb,'no result is an empty list';

 -- Only the public nickname and the caller's own relation; never an ID or an email.
 assert public.lumen_friend_request('Bruno972')='outgoing';
 perform set_config('request.jwt.claim.sub',berenice::text,true);
 assert public.lumen_friend_request('Alice972')='outgoing';
 perform set_config('request.jwt.claim.sub',alice::text,true);
 x:=public.lumen_friend_find('972');
 assert x->'results' @> jsonb_build_array(jsonb_build_object('nickname','Bruno972','state','outgoing'),
  jsonb_build_object('nickname','Bérénice972','state','incoming'),jsonb_build_object('nickname','Bru972','state','none')),'relation states: '||x::text;
 assert x::text !~ '0000-4000' and x::text !~ '@','no technical identifier or email';
 assert (select array_agg(distinct k) from jsonb_array_elements(x->'results') r,jsonb_object_keys(r) k)=array['nickname','state'],'only two public fields';
 perform set_config('request.jwt.claim.sub',bruno::text,true);
 assert public.lumen_friend_respond('Alice972',false)='declined';
 perform set_config('request.jwt.claim.sub',alice::text,true);
 -- #35 quiet decline: neither side learns it, exactly like lumen_friend_search.
 assert public.lumen_friend_find('bruno972')->'results'->0->>'state'='none','a quietly declined request shows as none';
 assert public.lumen_friend_find('bruno972')->'results'->0->>'state'=public.lumen_friend_search('Bruno972')->>'state','same state as the exact search';
 perform set_config('request.jwt.claim.sub',bruno::text,true);
 assert public.lumen_friend_find('alice972')->'results'->0->>'state'='none','the decliner sees none too';

 -- Pagination: 8 per page, at most 3 pages (24 nicknames per query).
 for i in 1..30 loop
  star:=('00000000-0000-4000-8000-000000973'||lpad(i::text,3,'0'))::uuid;
  insert into auth.users(id) values(star);
  insert into lumen.profiles(user_id,nickname,nickname_ready) values(star,'Star972x'||lpad(i::text,2,'0'),true);
 end loop;
 perform set_config('request.jwt.claim.sub',alice::text,true);
 x:=public.lumen_friend_find('star');
 assert jsonb_array_length(x->'results')=8 and x->>'more'='true' and x->'results'->0->>'nickname'='Star972x01','page 1: '||x::text;
 x:=public.lumen_friend_find('star',1);
 assert jsonb_array_length(x->'results')=8 and x->'results'->0->>'nickname'='Star972x09' and x->>'more'='true','page 2';
 x:=public.lumen_friend_find('star',2);
 assert jsonb_array_length(x->'results')=8 and x->>'more'='false','page 3 is the last one even with 30 matches';

 -- 60 searches per account per rolling hour, then a clear refusal; the window resets.
 perform set_config('request.jwt.claim.sub',spammer::text,true);
 for i in 1..60 loop perform public.lumen_friend_find('star');end loop;
 begin perform public.lumen_friend_find('star');raise exception '61st search accepted';
 exception when raise_exception then if sqlerrm<>'search_rate_limited' then raise;end if;end;
 assert (select searches from lumen.social_search_budget where user_id=spammer)=60,'a refused search is not stored';
 update lumen.social_search_budget set window_start=now()-interval '61 minutes' where user_id=spammer;
 assert jsonb_array_length(public.lumen_friend_find('star')->'results')=8,'a new hour opens a new budget';
 assert (select searches from lumen.social_search_budget where user_id=spammer)=1;
 assert (select count(*) from lumen.social_search_budget)=3,'one budget row per searching account (Alice, Bruno, Spam)';

 -- No direct table access; anonymous callers cannot execute.
 assert not has_table_privilege('authenticated','lumen.social_search_budget','select');
 assert not has_function_privilege('anon','public.lumen_friend_find(text,integer)','execute');
 assert has_function_privilege('authenticated','public.lumen_friend_find(text,integer)','execute');

 -- Lumen erasure removes the budget row when the privacy policy is installed.
 if to_regprocedure('lumen_privacy.erase_account(uuid,text[],text)') is not null then
  perform set_config('request.jwt.claim.sub','',true);
  assert exists(select 1 from lumen_privacy.policy() where ns='lumen' and rel='social_search_budget'),'budget registered for erasure';
  perform lumen_privacy.erase_account(spammer,array[]::text[],'ERASE LUMEN '||spammer::text);
  assert not exists(select 1 from lumen.social_search_budget where user_id=spammer),'no budget survives erasure';
 end if;
end $$;
rollback;
