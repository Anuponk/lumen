-- Disposable fixture target only, under normal READ COMMITTED.
select lumen_privacy.erase_account('00000000-0000-0000-0000-000000009401',array['rights-guest'],
 'ERASE LUMEN 00000000-0000-0000-0000-000000009401');
