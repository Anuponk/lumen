-- Reject ambiguous identities within one batch before quota or data writes.
-- This is a telemetry-only function change; no player data is read or modified.
do $$declare definition text;needle text:='if jsonb_array_length(p_events) not between 1 and 10 then';begin
 select pg_get_functiondef('lumen_commands.record_diagnostics(uuid,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'review changed diagnostic batch validation';end if;
 execute replace(definition,needle,
  'if jsonb_array_length(p_events) not between 1 and 10 or (select count(distinct lower(value->>''id'')) from jsonb_array_elements(p_events))<>jsonb_array_length(p_events) then');
end $$;
notify pgrst,'reload schema';
