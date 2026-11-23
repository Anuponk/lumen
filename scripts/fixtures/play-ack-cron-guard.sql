-- #995: the acknowledgement job calls the Edge Function only when the claim or
-- the prune it triggers has something to do. Runs after play-acknowledgement.sql.
begin;
do $$
declare
  player constant uuid := '00000000-0000-0000-0000-000000099501';
  token constant text := 'synthetic-995-token';
  ref text := encode(sha256(convert_to(token,'UTF8')),'hex');
  purchase_key bigint;
  job constant text := E'\nselect net.http_post(\n  url := ''https://example.invalid/functions/v1/lumen-play-purchase'',\n'
    || E'  body := jsonb_build_object(''mode'', ''acknowledge''),\n  headers := jsonb_build_object(''x-lumen-cron'', s.decrypted_secret)\n)\n'
    || E'from vault.decrypted_secrets s\nwhere s.name = ''lumen_play_cron_secret''\n  and length(s.decrypted_secret) >= 32;\n';
  guarded text;
begin
  assert not has_function_privilege('service_role','lumen_commands.play_acknowledgement_due()','EXECUTE');
  assert not has_function_privilege('authenticated','lumen_commands.guard_play_ack_command(text)','EXECUTE');

  -- Empty queue (production state on 23/11/2026): no HTTP call.
  assert not lumen_commands.play_acknowledgement_due(), 'empty queue must not wake the Edge Function';

  insert into auth.users(id) values(player);
  purchase_key:=(public.lumen_record_play_purchase_with_ack(ref,player,'real-adventure-04',null,null,false,true,null,token,false)->>'purchase_id')::bigint;
  assert lumen_commands.play_acknowledgement_due(), 'a new unacknowledged purchase is due at once';

  -- Leased by a claim: not due until the retry time, then due again.
  perform public.lumen_claim_play_acknowledgements(purchase_key);
  assert not lumen_commands.play_acknowledgement_due(), 'a leased acknowledgement waits for its retry time';
  update lumen_commands.play_acknowledgements set retry_at=statement_timestamp()-interval '1 second' where purchase_id=purchase_key;
  assert lumen_commands.play_acknowledgement_due();

  -- Expired token (4 days): still due so the prune clears it, then idle.
  update lumen_commands.play_acknowledgements set retry_at=statement_timestamp()+interval '1 hour',
    created_at=statement_timestamp()-interval '5 days' where purchase_id=purchase_key;
  assert lumen_commands.play_acknowledgement_due(), 'an expired token must still reach the prune';
  perform public.lumen_prune_play_acknowledgements();
  assert not lumen_commands.play_acknowledgement_due();

  -- Acknowledged rows never wake the job.
  update lumen_commands.play_acknowledgements set purchase_token=null, acknowledged_at=clock_timestamp(),
    created_at=statement_timestamp(), retry_at=statement_timestamp()-interval '1 second' where purchase_id=purchase_key;
  assert not lumen_commands.play_acknowledgement_due();

  -- Command rewrite: guard appended once, secret lookup and cadence untouched.
  guarded:=lumen_commands.guard_play_ack_command(job);
  assert guarded like '%and length(s.decrypted_secret) >= 32%and lumen_commands.play_acknowledgement_due();%', guarded;
  assert guarded like '%s.decrypted_secret%' and guarded like '%''acknowledge''%';
  assert lumen_commands.guard_play_ack_command(guarded)=guarded, 'rewrite is idempotent';
  assert lumen_commands.guard_play_ack_command(replace(job,'''acknowledge''','''voided'''))=replace(job,'''acknowledge''','''voided'''),
    'the daily voided reconciliation is never guarded';
  assert lumen_commands.guard_play_ack_command('select 1;')='select 1;', 'unexpected shapes stay unchanged';
  assert lumen_commands.guard_play_ack_command(null) is null;

  delete from auth.users where auth.users.id=player;
end $$;
rollback;
