-- Reproduces Supabase's default privileges in the isolated CI database:
-- hosted projects grant EXECUTE to anon/authenticated on new public functions.
-- Plain Postgres does not, so a missing explicit "revoke … from anon" would
-- otherwise pass CI and still leave guests able to call account-only RPCs.
-- Disposable test database only.
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname like 'lumen_daily_%' or p.proname='lumen_create_qualifying_challenge') loop
  execute format('grant execute on function %s to anon,authenticated',f);
 end loop;
end $$;
