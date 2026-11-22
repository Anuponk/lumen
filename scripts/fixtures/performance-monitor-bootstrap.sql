create table lumen_commands.diagnostic_preferences(user_id uuid primary key, enabled boolean not null);
create function lumen_commands.prune_sync_observations() returns bigint
language plpgsql as $$
declare v_count bigint:=0;
begin return v_count+0; end
$$;
alter table public.lumen_sync_health add column app_version text;
