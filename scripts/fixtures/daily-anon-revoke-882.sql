-- #882 / #889: after Supabase-like default grants, only lumen_daily_today stays
-- callable by guests; account RPCs stay callable by authenticated players.
do $$
declare f record;
begin
 assert has_function_privilege('anon','public.lumen_daily_today()','EXECUTE'),'guests can read today (enabled:false while disabled)';
 for f in select p.oid::regprocedure as sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname like 'lumen_daily_%' or p.proname='lumen_create_qualifying_challenge') and p.proname<>'lumen_daily_today' loop
  assert not has_function_privilege('anon',f.sig,'EXECUTE'),'anon must not execute '||f.sig::text;
  assert has_function_privilege('authenticated',f.sig,'EXECUTE'),'players keep '||f.sig::text;
 end loop;
 assert (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'lumen_daily_%')=7,'seven daily RPCs checked';
end $$;
