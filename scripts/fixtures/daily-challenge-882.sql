-- #882 (EPIC #881 Lot 3): daily challenge contracts on the real migrated schema.
-- Disposable fixture only: invented identities, everything rolled back.
begin;
do $$
declare
 a constant uuid:='00000000-0000-4000-8000-000000088201';
 b constant uuid:='00000000-0000-4000-8000-000000088202';
 c constant uuid:='00000000-0000-4000-8000-000000088203';
 nonick constant uuid:='00000000-0000-4000-8000-000000088204';
 e constant uuid:='00000000-0000-4000-8000-000000088205';
 today date:=lumen_commands.daily_today();past date;q text;rev integer;x jsonb;board jsonb;w jsonb;started timestamptz;
 profiles bigint;scores bigint;receipts bigint;
begin
 insert into auth.users(id) values(a),(b),(c),(nonick),(e);
 insert into lumen.profiles(user_id,nickname) values(a,'Ada882'),(b,'Bea882'),(c,'Cyd882'),(e,'Eve882');
 update lumen.profiles set ranking_opted_out=true where user_id=c;
 insert into lumen_commands.ranking_members(user_id,nickname,participating) values(a,'Ada882',true),(b,'Bea882',true),(e,'Eve882',true)
  on conflict(user_id) do update set participating=true;
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values(a,b,'friends'),(b,a,'friends'),(a,c,'friends'),(c,a,'friends');
 select quest_id,grid_revision into q,rev from lumen_commands.quest_rules where quest_id like 'pack-real-adventure-05-%' order by quest_id limit 1;
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision) values(today,q,rev)
  on conflict(day) do update set quest_id=excluded.quest_id,grid_revision=excluded.grid_revision;
 select count(*) into profiles from lumen.profile_snapshots;
 select count(*) into scores from lumen_commands.ranking_scores;
 select count(*) into receipts from lumen_commands.canonical_receipts;

 -- Disabled by default: no public play, no grid disclosure.
 perform set_config('request.jwt.claim.sub','',true);
 assert public.lumen_daily_today()->>'enabled'='false' and not (public.lumen_daily_today() ? 'quest_id'),'disabled mode discloses nothing';
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.lumen_daily_begin('dc-a1');raise exception 'disabled begin accepted';
 exception when insufficient_privilege then if sqlerrm<>'daily_disabled' then raise;end if;end;
 -- A previewer (admin/QA) can rehearse before activation.
 insert into lumen.internal_capabilities(user_id,capability) values(a,'daily_preview');
 assert public.lumen_daily_today()->>'quest_id'=q,'previewer sees the grid';
 delete from lumen.internal_capabilities where user_id=a and capability='daily_preview';
 update lumen_commands.feature_flags set enabled=true where name='daily_challenge';

 -- Same grid for everyone, guests included (identity only, not personal data).
 perform set_config('request.jwt.claim.sub','',true);
 x:=public.lumen_daily_today();
 assert x->>'quest_id'=q and (x->>'grid_revision')::integer=rev and (x->>'day')::date=today,'same grid for every player';
 begin perform public.lumen_daily_begin('dc-guest');raise exception 'guest ranked';
 exception when insufficient_privilege then if sqlerrm<>'account_required' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',nonick::text,true);
 begin perform public.lumen_daily_begin('dc-n');raise exception 'no nickname ranked';
 exception when insufficient_privilege then if sqlerrm<>'nickname_required' then raise;end if;end;

 -- One official attempt: reload / other device return the same row and start.
 perform set_config('request.jwt.claim.sub',a::text,true);
 x:=public.lumen_daily_begin('dc-a1');started:=(x->>'started_at')::timestamptz;
 assert x->>'status'='started' and x->>'quest_id'=q,'attempt opened on the day grid';
 x:=public.lumen_daily_begin('dc-a2');
 assert x->>'operation_id'='dc-a1' and (x->>'started_at')::timestamptz=started and (x->>'resumed')::boolean,'resume keeps the same server start';
 assert (select count(*) from lumen_commands.daily_runs where user_id=a)=1,'never two attempts';
 begin perform public.lumen_daily_finish(today,'dc-a2','completed',60,0,0,0);raise exception 'foreign operation finished';
 exception when invalid_parameter_value then if sqlerrm<>'operation_mismatch' then raise;end if;end;
 begin perform public.lumen_daily_finish(today,'dc-a1','completed',600,0,0,0);raise exception 'impossible duration accepted';
 exception when invalid_parameter_value then if sqlerrm<>'invalid_duration' then raise;end if;end;
 update lumen_commands.daily_runs set started_at=clock_timestamp()-interval '10 minutes' where user_id=a and day=today;
 -- Official penalties: hint 15 s, verify and guided 5 s (same formula as #638).
 x:=public.lumen_daily_finish(today,'dc-a1','completed',120,1,1,1);
 assert x->>'status'='completed' and (x->>'score')::integer=145 and (x->>'penalty')::integer=25,'official time with penalties';
 x:=public.lumen_daily_finish(today,'dc-a1','completed',30,0,0,0);
 assert (x->>'replayed')::boolean and (x->>'score')::integer=145,'a repeated submission never changes the result';
 x:=public.lumen_daily_begin('dc-a3');
 assert x->>'status'='completed' and (x->>'score')::integer=145,'after the official attempt only training remains';

 -- B ties with A; C is faster but opted out of public rankings; E has no friends.
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.lumen_daily_begin('dc-b1');
 update lumen_commands.daily_runs set started_at=clock_timestamp()-interval '10 minutes' where user_id=b and day=today;
 perform public.lumen_daily_finish(today,'dc-b1','completed',145,0,0,0);
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform public.lumen_daily_begin('dc-c1');
 update lumen_commands.daily_runs set started_at=clock_timestamp()-interval '10 minutes' where user_id=c and day=today;
 perform public.lumen_daily_finish(today,'dc-c1','completed',100,0,0,0);
 perform set_config('request.jwt.claim.sub',e::text,true);
 perform public.lumen_daily_begin('dc-e1');
 update lumen_commands.daily_runs set started_at=clock_timestamp()-interval '10 minutes' where user_id=e and day=today;
 perform public.lumen_daily_finish(today,'dc-e1','completed',300,0,0,0);

 -- Both boards come from the same rows; ties share a rank.
 perform set_config('request.jwt.claim.sub',a::text,true);
 board:=public.lumen_daily_board();
 assert (board->'general'->>'participants')::integer=3,'general counts real participating players only';
 assert board->'general'->'top'->0->>'rank'='1' and board->'general'->'top'->1->>'rank'='1' and board->'general'->'top'->2->>'rank'='3','ties share the same rank';
 assert board->'general'->'me'=jsonb_build_object('rank',1,'score',145),'personal position';
 assert (board->'friends'->>'participants')::integer=2,'friends = me + participating friends';
 assert board->'friends'->'me'=jsonb_build_object('rank',1,'score',145),'same performance in both boards';
 assert board::text !~ '0000-4000' and board::text !~ '@','no UUID or email exposed';
 assert not (board->'general'->'top'->0 ? 'user_id'),'public fields only';
 perform set_config('request.jwt.claim.sub',c::text,true);
 board:=public.lumen_daily_board();
 assert board->'general'->'me'->'rank'='null' and (board->'general'->>'participants')::integer=3,'an opted-out player is never listed publicly';
 assert board->'friends'->'me'=jsonb_build_object('rank',1,'score',100),'an opted-out player still sees his own result among friends';
 perform set_config('request.jwt.claim.sub',e::text,true);
 board:=public.lumen_daily_board();
 assert (board->'friends'->>'participants')::integer=1 and jsonb_array_length(board->'friends'->'top')=1,'no friend played: only me, no invented player';

 -- Abandon is final for the day.
 insert into auth.users(id) values('00000000-0000-4000-8000-000000088206');
 insert into lumen.profiles(user_id,nickname) values('00000000-0000-4000-8000-000000088206','Fay882');
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000088206',true);
 perform public.lumen_daily_begin('dc-f1');
 assert public.lumen_daily_finish(today,'dc-f1','abandoned',0,0,0,0)->>'status'='abandoned';
 assert public.lumen_daily_begin('dc-f2')->>'status'='abandoned','no new official attempt after an abandon';

 -- No campaign, podium or receipt write; a locked Adventure grid needs no entitlement.
 assert (select count(*) from lumen.profile_snapshots)=profiles and (select count(*) from lumen_commands.ranking_scores)=scores
  and (select count(*) from lumen_commands.canonical_receipts)=receipts,'daily play never touches campaign data';

 -- Europe/Paris days of 23 h and 25 h at DST changes.
 assert lumen_commands.daily_closes_at('2027-03-28')-lumen_commands.daily_opens_at('2027-03-28')=interval '23 hours','spring forward';
 assert lumen_commands.daily_closes_at('2026-10-25')-lumen_commands.daily_opens_at('2026-10-25')=interval '25 hours','fall back';
 assert lumen_commands.daily_opens_at('2026-11-23')='2026-11-22 23:00:00+00','Paris midnight';

 -- Expiry: a run left open more than 6 h is closed without rank.
 past:=today-3;
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision) values(past,q,rev) on conflict(day) do update set quest_id=excluded.quest_id,grid_revision=excluded.grid_revision;
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,started_at,status,seconds,hint,verify,guided,score,finished_at) values
  (a,past,'dc-pa',q,rev,clock_timestamp()-interval '3 days','completed',200,0,0,0,200,clock_timestamp()-interval '3 days'),
  (b,past,'dc-pb',q,rev,clock_timestamp()-interval '3 days','completed',150,0,0,0,150,clock_timestamp()-interval '3 days'),
  (e,past,'dc-pe',q,rev,clock_timestamp()-interval '3 days','started',null,null,null,null,null,null);

 -- Finalization freezes ranks; later friendship or opt-out changes do not rewrite history.
 perform set_config('request.jwt.claim.sub',a::text,true);
 board:=public.lumen_daily_board(past);
 assert (board->>'final')::boolean and board->'general'->'me'=jsonb_build_object('rank',2,'score',200),'final past board';
 assert (select status from lumen_commands.daily_runs where user_id=e and day=past)='abandoned','stale run closed at finalization';
 delete from lumen.social_friend_edges where (user_id=a and friend_user_id=b) or (user_id=b and friend_user_id=a);
 update lumen_commands.ranking_members set participating=false where user_id=b;
 board:=public.lumen_daily_board(past);
 assert board->'general'->'me'=jsonb_build_object('rank',2,'score',200) and (board->'friends'->>'participants')::integer=2,'frozen past ranks';
 w:=public.lumen_daily_week(past);
 assert jsonb_array_length(w->'days')=7,'Monday to Sunday';
 assert exists(select 1 from jsonb_array_elements(w->'days') d where d->>'day'=past::text and d->>'state'='completed' and d->>'final'='true'
   and d->>'general_rank'='2' and d->>'general_total'='2' and d->>'friends_rank'='2' and d->>'friends_total'='2'),'weekly summary uses frozen ranks';
 perform set_config('request.jwt.claim.sub',e::text,true);
 w:=public.lumen_daily_week(past);
 assert exists(select 1 from jsonb_array_elements(w->'days') d where d->>'day'=past::text and d->>'state'='abandoned'),'unfinished day shown honestly';
 assert not exists(select 1 from jsonb_array_elements(w->'days') d where d->>'state' not in ('completed','abandoned','missed','future','started')),'no invented state';

 -- Admin preview/override: future only, never after a run.
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin perform public.lumen_daily_preview();raise exception 'non-admin preview';
 exception when insufficient_privilege then if sqlerrm<>'admin_required' then raise;end if;end;
 insert into lumen.internal_capabilities(user_id,capability) values(b,'daily_preview');
 assert jsonb_array_length(public.lumen_daily_preview(today,3))>=1;
 begin perform public.lumen_daily_override(today,q,rev);raise exception 'open day replaced';
 exception when invalid_parameter_value then if sqlerrm<>'daily_already_open' then raise;end if;end;
 assert public.lumen_daily_override(today+1,q,rev)->>'source'='override';

 -- Privileges and erasure.
 assert not has_table_privilege('authenticated','lumen_commands.daily_runs','SELECT') and not has_table_privilege('anon','lumen_commands.daily_standings','SELECT');
 assert has_function_privilege('anon','public.lumen_daily_today()','execute') and not has_function_privilege('anon','public.lumen_daily_begin(text)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.daily_ranks(date,uuid)','execute'),'rank source stays private';
 perform set_config('request.jwt.claim.sub','',true);
 x:=lumen_privacy.review_erasure(b,array[]::text[]);
 assert (x->'tables'->'lumen_commands.daily_runs'->>'rows')::integer=2 and (x->'tables'->'lumen_commands.daily_standings'->>'rows')::integer=1,'erasure review sees daily data';
 perform lumen_privacy.erase_account(b,array[]::text[],'ERASE LUMEN '||b::text);
 assert not exists(select 1 from lumen_commands.daily_runs where user_id=b) and not exists(select 1 from lumen_commands.daily_standings where user_id=b);
 assert (select general_rank from lumen_commands.daily_standings where user_id=a and day=past)=2,'other players keep their frozen history';
end $$;
rollback;
