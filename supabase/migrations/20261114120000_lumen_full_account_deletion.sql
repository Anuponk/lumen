-- #316 follow-up (owner decision 2026-11-14): "Supprimer mon compte" deletes the
-- whole sign-in account once Lumen data is erased, unless the same account is
-- used by another application of this shared Supabase project (SoldeZen, nounou…),
-- whose tables cascade from auth.users. SQL never deletes auth.users itself: it
-- only answers whether deletion is safe; the Edge Function performs it through
-- the Auth admin API. Any doubt or error keeps the account (fail closed).

-- True when any non-Lumen table references the user. Scans every column with a
-- foreign key to auth.users plus uuid columns named like an owner/author outside
-- Lumen namespaces. Errors count as "used elsewhere".
create or replace function lumen_privacy.account_used_elsewhere(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r record; found boolean;
begin
 if p_user_id is null then return true; end if;
 for r in
  select distinct n.nspname as ns, c.relname as rel, a.attname as col
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid=a.attrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
   and a.atttypid='uuid'::regtype
   and n.nspname not like 'lumen%' and n.nspname not like 'pg\_%'
   and n.nspname not in ('auth','storage','realtime','_realtime','supabase_functions','supabase_migrations',
    'extensions','graphql','graphql_public','pgsodium','pgsodium_masks','vault','net','cron','pgbouncer','information_schema')
   and not (n.nspname='public' and c.relname like 'lumen\_%')
   and (exists(select 1 from pg_catalog.pg_constraint k where k.conrelid=c.oid and k.contype='f'
         and k.confrelid='auth.users'::regclass and a.attnum=any(k.conkey))
        or a.attname ~ '(user_id|owner_id|_by)$')
 loop
  execute format('select exists(select 1 from %I.%I where %I=$1)',r.ns,r.rel,r.col) into found using p_user_id;
  if found then return true; end if;
 end loop;
 return false;
exception when others then
 return true;
end $$;
revoke all on function lumen_privacy.account_used_elsewhere(uuid) from public,anon,authenticated,service_role;

-- Server-only decision for the Edge Function: the Lumen erasure barrier must
-- already exist for this user, and no other application may use the account.
create or replace function public.lumen_account_deletable(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.role()) is distinct from 'service_role' or auth.uid() is not null then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if p_user_id is null then return false; end if;
 if not exists(select 1 from lumen_privacy.erased_identifiers
  where kind='user' and digest=lumen_privacy.fingerprint(p_user_id::text)) then return false; end if;
 return not lumen_privacy.account_used_elsewhere(p_user_id);
end $$;
revoke all on function public.lumen_account_deletable(uuid) from public,anon,authenticated;
grant execute on function public.lumen_account_deletable(uuid) to service_role;

-- Lets a signed-in player learn only whether their own Lumen data was erased,
-- so the client explains it instead of asking for a nickname it cannot save.
create or replace function public.lumen_account_erased()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from lumen_privacy.erased_identifiers
  where kind='user' and digest=lumen_privacy.fingerprint(auth.uid()::text))
$$;
revoke all on function public.lumen_account_erased() from public,anon;
grant execute on function public.lumen_account_erased() to authenticated;

notify pgrst,'reload schema';
