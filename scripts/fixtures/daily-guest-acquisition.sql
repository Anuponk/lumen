-- Disposable accounts and a fictional proof. Everything stays in the SQL fixture.
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000001057';
  b constant uuid := '00000000-0000-4000-8000-000000001058';
  c constant uuid := '00000000-0000-4000-8000-000000001064';
  token constant text := repeat('a', 64);
  other_token constant text := repeat('b', 64);
  signup_token constant text := repeat('c', 64);
  day_today date := lumen_commands.daily_today();
  quest text;
  revision integer;
  answer constant integer[] := array[1,3,5,0,2,4,6];
  receipt jsonb;
  repeated jsonb;
  score integer;
  event_id uuid := gen_random_uuid();
begin
  select quest_id, grid_revision into strict quest, revision
  from lumen_commands.quest_rules order by quest_id limit 1;
  insert into auth.users(id) values(a), (b), (c);
  insert into lumen.profiles(user_id,nickname) values(a,'GuestFixtureA'),(b,'GuestFixtureB'),(c,'GuestFixtureC');
  insert into lumen_commands.daily_puzzles(day, quest_id, grid_revision, guest_solution_hash)
  values(day_today,quest,revision,sha256(convert_to(day_today::text||':'||quest||':'||revision||':1,3,5,0,2,4,6','UTF8')))
  on conflict(day) do update set quest_id=excluded.quest_id, grid_revision=excluded.grid_revision, guest_solution_hash=excluded.guest_solution_hash;
  update lumen_commands.feature_flags set enabled=true where name='daily_challenge';
  perform set_config('request.jwt.claim.sub','',true);
  assert public.lumen_daily_guest_begin(day_today,token)->>'status'='ineligible','guest flag starts disabled';
  update lumen_commands.feature_flags set enabled=true where name='daily_guest';
  assert public.lumen_daily_today()->>'guest_eligible'='true','only today advertises eligibility';
  assert not (public.lumen_daily_today() ? 'guest_solution_hash'),'verifier stays private';
  assert public.lumen_daily_guest_begin(day_today+1,token)->>'status'='ineligible','no future run';
  receipt := public.lumen_daily_guest_begin(day_today,token);
  assert receipt->>'status'='started','same day starts';
  assert public.lumen_daily_guest_begin(day_today,token)->>'operationId'=receipt->>'operationId','one run per guest identity';
  assert public.lumen_daily_guest_event(day_today,token,2,event_id,'hint')->>'status'='conflict','events must be ordered';
  receipt := public.lumen_daily_guest_event(day_today,token,1,event_id,'hint');
  repeated := public.lumen_daily_guest_event(day_today,token,1,event_id,'hint');
  assert receipt->>'eventNumber'=repeated->>'eventNumber','replay does not add penalty';
  perform public.lumen_daily_guest_event(day_today,token,2,gen_random_uuid(),'pause');
  update lumen_commands.daily_guest_runs set active_seconds=25
   where day=day_today and credential_hash=sha256(decode(token,'hex'));
  assert public.lumen_daily_guest_event(day_today,token,3,gen_random_uuid(),'finish',answer)->>'status'='ineligible','a paused clock cannot finish';
  perform public.lumen_daily_guest_event(day_today,token,3,gen_random_uuid(),'resume');
  assert public.lumen_daily_guest_event(day_today,token,4,gen_random_uuid(),'finish',array[0,1,2,3,4,5,6])->>'status'='ineligible','invalid solution';
  receipt := public.lumen_daily_guest_event(day_today,token,4,gen_random_uuid(),'finish',answer);
  score := (receipt->>'score')::int;
  assert receipt->>'status'='completed' and score >= 40,'verified score includes active time and a single penalty';
  assert public.lumen_daily_guest_event(day_today,token,5,gen_random_uuid(),'finish',answer)->>'score'=score::text,'cannot change the completed result';
  assert not exists(select 1 from lumen_commands.daily_runs where day=day_today and user_id in(a,b)),'no guest ranking';
  perform public.lumen_daily_guest_begin(day_today,other_token);
  perform public.lumen_daily_guest_event(day_today,other_token,1,gen_random_uuid(),'abandon');
  assert public.lumen_daily_guest_begin(day_today,other_token)->>'status'='abandoned','abandon is final';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.lumen_daily_begin('daily-fixture-existing');
  assert public.lumen_daily_guest_claim(day_today,token)->>'status'='already_played','account cannot replace any attempt';
  assert public.lumen_daily_guest_claim(day_today,other_token)->>'status'='already_played','existing attempt is retained';
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert public.lumen_daily_guest_claim(day_today,other_token)->>'status'='ineligible','abandon is never attributable';
  receipt := public.lumen_daily_guest_claim(day_today,token);
  assert receipt->>'status'='completed' and receipt->>'score'=score::text,'qualified receipt reaches the real ranking row';
  assert public.lumen_daily_guest_claim(day_today,token)=receipt,'account retry is idempotent';
  assert public.lumen_daily_guest_begin(day_today,token)->>'status'='ineligible','authenticated accounts cannot mint guest rows';
  assert not has_table_privilege('anon','lumen_commands.daily_guest_runs','SELECT');
  assert not has_function_privilege('anon','public.lumen_daily_guest_claim(date,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.lumen_daily_guest_begin(date,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.lumen_daily_guest_bind_signup(date,text,uuid)','EXECUTE');
  perform set_config('request.jwt.claim.sub','',true);
  perform public.lumen_daily_guest_begin(day_today,signup_token);
  perform public.lumen_daily_guest_event(day_today,signup_token,1,gen_random_uuid(),'finish',answer);
  assert public.lumen_daily_guest_bind_signup(day_today,signup_token,c),'real signup workflow binds the verified receipt';
  assert not public.lumen_daily_guest_bind_signup(day_today,signup_token,a),'binding cannot move to a different owner';
  perform set_config('request.jwt.claim.sub',b::text,true);
  assert public.lumen_daily_guest_claim(day_today,null)->>'status'='ineligible','no cross-account bound receipt';
  perform set_config('request.jwt.claim.sub',c::text,true);
  assert public.lumen_daily_guest_claim(day_today,null)->>'status'='ineligible','account must confirm its email';
  update auth.users set email_confirmed_at=clock_timestamp() where id=c;
  assert public.lumen_daily_guest_claim(day_today,null)->>'status'='completed','same confirmed account can claim on another browser';
end $$;
rollback;
