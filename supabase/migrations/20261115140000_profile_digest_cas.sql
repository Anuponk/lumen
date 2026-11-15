-- Profile compare-and-swap by SHA-256 of the expected profile (upload halved).
-- Additive. The client sends the digest of PostgreSQL's jsonb text for its
-- expected profile instead of the whole profile. The write itself still goes
-- through public.lumen_cas_profile (same validation, triggers and guards).
-- A digest mismatch (real conflict or a serialization difference) writes
-- nothing and returns matched=false; the client then runs the full CAS, so the
-- final outcome is always the one the existing full comparison would give.
create function public.lumen_cas_profile_digest(p_expected_sha256 text,p_payload jsonb,p_expected_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current jsonb;applied boolean;
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='profile account changed';end if;
 if p_expected_sha256 is null or p_expected_sha256 !~ '^[0-9a-f]{64}$'
 then raise exception using errcode='22023',message='invalid profile digest';end if;
 select s.payload into current from lumen.profile_snapshots s where s.user_id=auth.uid() for update;
 if not found or encode(sha256(convert_to(current::text,'UTF8')),'hex')<>p_expected_sha256
 then return jsonb_build_object('version',1,'matched',false,'applied',false);end if;
 applied:=public.lumen_cas_profile(current,p_payload);
 return jsonb_build_object('version',1,'matched',true,'applied',coalesce(applied,false));
end $$;
revoke all on function public.lumen_cas_profile_digest(text,jsonb,uuid) from public,anon;
grant execute on function public.lumen_cas_profile_digest(text,jsonb,uuid) to authenticated;
