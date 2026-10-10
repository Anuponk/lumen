-- Cloud-first snapshot creation and optimistic concurrency.
-- Deploy this migration BEFORE enabling the cloud-first client.
CREATE OR REPLACE FUNCTION public.lumen_initialize_profile(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_payload jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
   OR jsonb_typeof(p_payload->'solved') <> 'object'
   OR jsonb_typeof(p_payload->'badges') <> 'object'
   OR octet_length(p_payload::text) > 524288
 THEN RAISE EXCEPTION 'invalid Lumen profile'; END IF;
 INSERT INTO lumen.profile_snapshots (user_id,payload)
 VALUES (auth.uid(),p_payload)
 ON CONFLICT (user_id) DO NOTHING;
 SELECT payload INTO v_payload FROM lumen.profile_snapshots WHERE user_id=auth.uid();
 RETURN v_payload;
END;
$$;
CREATE OR REPLACE FUNCTION public.lumen_cas_profile(p_expected jsonb,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_updated int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
   OR jsonb_typeof(p_payload->'solved') <> 'object'
   OR jsonb_typeof(p_payload->'badges') <> 'object'
   OR octet_length(p_payload::text) > 524288
 THEN RAISE EXCEPTION 'invalid Lumen profile'; END IF;
 UPDATE lumen.profile_snapshots SET payload=p_payload,saved_at=now()
 WHERE user_id=auth.uid() AND payload=p_expected;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 RETURN v_updated=1;
END;
$$;
REVOKE ALL ON FUNCTION public.lumen_initialize_profile(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.lumen_cas_profile(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lumen_initialize_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lumen_cas_profile(jsonb,jsonb) TO authenticated;

-- Legacy overwrite revocation is deliberately deferred until all deployed clients
-- are cloud-first compatible. Revoking it in the preparation migration would
-- disrupt still-running production sessions before the application cutover.
