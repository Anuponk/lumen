-- Optional QA-only fixture. Never run against application schemas.
set local role lumen_recette_runner;
create function lumen_recette.reject_fixture_receipt() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.operation_id='recette-force-rollback' then raise exception 'recette receipt failure';end if;
 return new;
end $$;
revoke all on function lumen_recette.reject_fixture_receipt() from public,anon,authenticated,service_role;
create trigger recette_reject_receipt before insert on lumen_recette.canonical_receipts
for each row execute function lumen_recette.reject_fixture_receipt();
reset role;
