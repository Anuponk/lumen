-- #711 diagnostics: a failed hydration may report its stage in `outcome`, from
-- the client's fixed stage list (no identity, profile or free text). Anything
-- else is still stored as 'unknown'. Only the outcome allow-list changes; the
-- function keeps its body, owner, grants and SECURITY setting.
do $$
declare def text;fixed text;
begin
 select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='lumen_commands' and p.proname='record_sync_health';
 if def is null then raise exception 'record_sync_health missing';end if;
 if position('''mirror_readback''' in def)>0 then return;end if; -- already applied
 fixed:=replace(def,'''partial'',''resolved'')','''partial'',''resolved'',''start'',''local_read'',''cloud_restore'',''cloud_initialize'',''guest_reconciliation'',''guest_changed_during_hydration'',''wallet_establish'',''wallet_pending_read'',''wallet_receipt_read'',''wallet_profile_read'',''wallet_cache_restore'',''wallet_acknowledge'',''canonical_start_recovery'',''canonical_replay'',''legacy_replay'',''daily_rpc'',''daily_reconcile'',''daily_cloud_commit'',''owner_backup'',''local_reconciliation'',''bidirectional_reconciliation'',''achievement_recovery'',''achievement_local_read'',''achievement_backup'',''achievement_install'',''achievement_rollback'',''local_install'',''mirror_readback'')');
 if fixed=def then raise exception 'outcome allow-list not found';end if;
 execute fixed;
end $$;
