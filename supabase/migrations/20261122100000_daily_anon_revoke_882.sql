-- #882 / #889: Supabase default privileges grant EXECUTE to anon on every new
-- public function; revoking PUBLIC alone does not remove that direct grant.
-- These RPCs require an account: close anon explicitly (each one already
-- rejects guests internally). lumen_daily_today stays public by design.
-- Applied in production on 2026-11-21. Idempotent; no data change.
begin;
revoke execute on function public.lumen_daily_begin(text),
 public.lumen_daily_finish(date,text,text,integer,integer,integer,integer),
 public.lumen_daily_board(date),public.lumen_daily_week(date),
 public.lumen_daily_preview(date,integer),public.lumen_daily_override(date,text,integer) from anon;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='lumen_create_qualifying_challenge' loop
  execute format('revoke execute on function %s from anon',f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
