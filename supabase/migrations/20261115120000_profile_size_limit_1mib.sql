-- Profile size headroom: 512 KiB -> 1 MiB for every profile-writing function.
-- Measured on 15/11/2026: the largest real profile is 322 KB at 584/880 quests
-- (about 485 KB projected at 880, before replays/resets and future packs).
-- Only the numeric ceiling changes; every function keeps its body, owner,
-- grants, SECURITY setting and search_path (CREATE OR REPLACE of its own
-- definition). Support captures (validate_support) keep their separate limit.
-- Idempotent: a second run finds nothing left to replace.
do $$
declare f record;changed integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','lumen_commands') and p.prokind='f' and p.prosrc like '%524288%'
   and p.proname<>'validate_support'
 loop
  execute replace(pg_get_functiondef(f.oid),'524288','1048576');changed:=changed+1;
 end loop;
 raise notice 'profile size limit raised in % function(s)',changed;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','lumen_commands') and p.prosrc like '%524288%' and p.proname<>'validate_support')
 then raise exception 'profile size limit not fully raised';end if;
end $$;
