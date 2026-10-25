begin isolation level repeatable read read only;
do $$begin
 perform lumen_privacy.retain_technical_data();
 begin
  perform lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA');
  raise exception 'Repeatable-read purge accepted';
 exception when invalid_transaction_state then null; end;
end $$;
rollback;
