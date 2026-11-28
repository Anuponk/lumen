-- PostgreSQL fixture. Run only against a disposable local database.
begin;

insert into lumen.internal_capabilities(user_id, capability, source, expires_at)
values
  ('00000000-0000-0000-0000-000000001087','ux_v2_preview','fixture #1087',null),
  ('00000000-0000-0000-0000-000000001088','ux_v2_preview','fixture #1087',now()-interval '1 day');

do $$
begin
  if has_function_privilege('anon','public.lumen_ux_v2_access()','execute') then
    raise exception 'anon must not be able to call the beta RPC';
  end if;
  if has_table_privilege('authenticated','lumen_commands.feature_flags','update') then
    raise exception 'only operators may change the flag';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001087","is_anonymous":false}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'default must be off'; end if;
end $$;
reset role;

update lumen_commands.feature_flags set enabled=true where name='ux_preview';
set local role authenticated;
do $$ begin
  if public.lumen_ux_v2_access() is distinct from true then raise exception 'eligible owner denied'; end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001087","is_anonymous":true}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'anonymous account admitted'; end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001088","is_anonymous":false}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'expired access admitted'; end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001089","is_anonymous":false}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'unauthorized account admitted'; end if;
end $$;

select set_config('request.jwt.claims','{}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'unidentified session admitted'; end if;
end $$;
reset role;

update lumen_commands.feature_flags set enabled=false where name='ux_preview';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000001087","is_anonymous":false}',true);
do $$ begin
  if public.lumen_ux_v2_access() is distinct from false then raise exception 'kill switch did not revoke access'; end if;
end $$;

rollback;
