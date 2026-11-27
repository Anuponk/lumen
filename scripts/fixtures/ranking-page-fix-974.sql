-- Disposable PostgreSQL only; synthetic players, rolled back. #974 hotfix: a page
-- of the adventure ranking (p_limit>0) must work on a connection that never served
-- the opening read (fresh PL/pgSQL plan, as on a pooled PostgREST connection), and
-- pages must return every rank after the podium once, without the personal summary.
-- Run this file in its OWN psql session so the function plan is not yet cached.
begin;
do $$
declare
 ids uuid[]:=array(select ('00000000-0000-4000-8000-0000009740'||lpad(g::text,2,'0'))::uuid from generate_series(1,14) g);
 a constant text:='adventure-page-fix-974';
 r jsonb; names text[]:='{}'; off integer:=3; page jsonb;
begin
 insert into auth.users(id) select unnest(ids);
 insert into lumen.profiles(user_id,nickname) select ids[g],'Page974_'||g from generate_series(1,14) g;
 insert into lumen_commands.ranking_groups(quest_id,constellation_id,adventure_id) values('page-fix-974-q1','page-fix-974-c1',a);
 -- Two players tied at the same points, then decreasing scores.
 insert into lumen_commands.ranking_adventure_totals(adventure_id,user_id,points,quests)
  select a,ids[g],case when g<=2 then 1000 else 1000-g*10 end,1 from generate_series(1,14) g;
 perform set_config('request.jwt.claim.sub',ids[14]::text,true);
 -- First call of the session is a PAGE: this is what failed in production.
 page:=public.lumen_group_ranking('adventure',a,3,10);
 assert jsonb_array_length(page->'rows')=10,'page without a previous opening read: '||page::text;
 assert page->'personal'='null'::jsonb and jsonb_array_length(page->'top')=0,'a page does not resend podium or summary';
 assert (page->>'more')::boolean,'four more players remain';
 select array_agg(x->>'nickname') into names from jsonb_array_elements(page->'rows') x;
 page:=public.lumen_group_ranking('adventure',a,13,10);
 assert jsonb_array_length(page->'rows')=1 and not (page->>'more')::boolean,'last page: '||page::text;
 assert (page->'rows'->0->>'mine')::boolean and (page->'rows'->0->>'place')::int=14,'my row on the last page';
 names:=names||(page->'rows'->0->>'nickname');
 r:=public.lumen_group_ranking('adventure',a);
 assert (r->>'participants')::int=14 and (r->'personal'->>'place')::int=14 and (r->'personal'->>'points')::int=860,r::text;
 select names||array_agg(x->>'nickname') into names from jsonb_array_elements(r->'top') x;
 assert cardinality(names)=14 and (select count(distinct n) from unnest(names) n)=14,'every rank exactly once';
 assert (r->'top'->0->>'place')::int=1 and (r->'top'->1->>'place')::int=1,'ties share a rank';
end $$;
rollback;
