-- #729: server-only gateway used by the Google Play verifier Edge Function
-- (supabase/functions/lumen-play-purchase). Only service_role may call these; players
-- and anonymous clients cannot record, price-check or look up purchases.
-- Re-applying this migration is safe.
begin;

create or replace function public.lumen_store_price(p_product_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('product_id',s.product_id,'kind',s.kind,'price_cents',s.price_cents,'currency',s.currency,'active',s.active)
 from lumen_commands.store_products s where s.product_id=p_product_id;
$$;
revoke all on function public.lumen_store_price(text) from public,anon,authenticated;
grant execute on function public.lumen_store_price(text) to service_role;

create or replace function public.lumen_record_purchase(
 p_provider text,p_provider_ref text,p_user_id uuid,p_product_id text,p_amount_cents integer,
 p_currency text,p_status text,p_purchased_at timestamptz default null)
returns jsonb language sql security definer set search_path='' as $$
 select lumen_commands.record_purchase(p_provider,p_provider_ref,p_user_id,p_product_id,p_amount_cents,p_currency,p_status,p_purchased_at);
$$;
revoke all on function public.lumen_record_purchase(text,text,uuid,text,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.lumen_record_purchase(text,text,uuid,text,integer,text,text,timestamptz) to service_role;

-- Refund/void processing needs the original identity to replay record_purchase.
create or replace function public.lumen_purchase_by_ref(p_provider text,p_provider_ref text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p.user_id,'product_id',p.product_id,'amount_cents',p.amount_cents,
  'currency',p.currency,'status',p.status,'purchased_at',p.purchased_at)
 from lumen_commands.purchases p where p.provider=p_provider and p.provider_ref=p_provider_ref;
$$;
revoke all on function public.lumen_purchase_by_ref(text,text) from public,anon,authenticated;
grant execute on function public.lumen_purchase_by_ref(text,text) to service_role;

notify pgrst,'reload schema';
commit;
