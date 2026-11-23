-- #1000 lot 1: confirm a known profile by its SHA-256 instead of downloading it.
-- Additive and read-only. Returns the digest of the exact jsonb text that
-- lumen_restore_profile would return (same hash as lumen_cas_profile_digest).
-- The client compares it with the digest of profiles it already holds; any
-- difference, a missing endpoint or an unexpected answer falls back to the
-- full read, so a mismatch can never install an unverified profile.
create function public.lumen_profile_digest(p_expected_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare current jsonb;
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='profile account changed';end if;
 select s.payload into current from lumen.profile_snapshots s where s.user_id=auth.uid();
 return jsonb_build_object('version',1,'sha256',
  case when current is null then null else encode(sha256(convert_to(current::text,'UTF8')),'hex') end);
end $$;
revoke all on function public.lumen_profile_digest(uuid) from public,anon;
grant execute on function public.lumen_profile_digest(uuid) to authenticated;
