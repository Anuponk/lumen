-- Read only the authenticated player's confirmed purchase progress.
begin;
create or replace function public.lumen_get_main_sky_purchase_progress(p_expected_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'purchased', adventures_purchased,
    'remaining', greatest(0,5-adventures_purchased),
    'unlocked', sky_purchased or adventures_purchased >= 5
  )
  from lumen_commands.main_sky_purchase_status(auth.uid())
  where auth.uid() = p_expected_user_id;
$$;
revoke all on function public.lumen_get_main_sky_purchase_progress(uuid) from public,anon;
grant execute on function public.lumen_get_main_sky_purchase_progress(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
