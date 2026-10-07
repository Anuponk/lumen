-- Issue #150: make beta feedback submission callable by app users.
-- The previous function was created as invoker and had no explicit EXECUTE grants,
-- so anon/authenticated clients could fail before reaching the guarded insert.

create or replace function public.lumen_send_feedback(
 p_anonymous_id text,p_kind text,p_message text,p_puzzle_id integer,p_board_state jsonb,
 p_elapsed_seconds integer,p_hints_used integer,p_app_version text,p_user_agent text
) returns void
language plpgsql security definer set search_path=''
as $$
begin
 if length(p_anonymous_id) between 8 and 100
    and p_kind in ('like','lost','bug','idea','rule','difficulty','other')
    and (p_puzzle_id is null or p_puzzle_id between 1 and 10000)
 then
  insert into lumen.feedback(user_id,anonymous_id,kind,message,puzzle_id,board_state,elapsed_seconds,hints_used,app_version,user_agent)
  values(auth.uid(),p_anonymous_id,p_kind,nullif(left(coalesce(p_message,''),2000),''),
         p_puzzle_id,p_board_state,greatest(coalesce(p_elapsed_seconds,0),0),greatest(coalesce(p_hints_used,0),0),
         left(coalesce(p_app_version,''),100),left(coalesce(p_user_agent,''),500));
 end if;
end $$;

revoke all on function public.lumen_send_feedback(text,text,text,integer,jsonb,integer,integer,text,text) from public;
grant execute on function public.lumen_send_feedback(text,text,text,integer,jsonb,integer,integer,text,text) to anon,authenticated,service_role;
