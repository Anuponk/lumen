create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema lumen;
create schema lumen_commands;
create schema lumen_privacy;
create table auth.users(id uuid primary key, created_at timestamptz, email_confirmed_at timestamptz, raw_app_meta_data jsonb);
create table lumen.users(user_id uuid primary key, first_seen_at timestamptz);
create table lumen.entitlements(user_id uuid, entitlement text, expires_at timestamptz);
create table lumen_commands.adventure_packs(pack_id text primary key, access text);
create table lumen_commands.store_products(product_id text primary key, kind text, pack_id text);
create table lumen_commands.purchases(
 id bigint primary key, provider text, provider_ref text, user_id uuid, product_id text,
 amount_cents integer, currency text, status text, purchased_at timestamptz,
 settled_amount numeric, settled_currency text
);
create table lumen_commands.purchase_events(id bigint primary key, purchase_id bigint, status text, recorded_at timestamptz);
create table lumen_commands.stripe_checkout_sessions(
 session_id text primary key, livemode boolean, status text, user_id uuid, product_id text, amount_cents int, currency text
);
create function lumen_privacy.policy() returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql as $$ select null::text,null::text,null::text,null::text,null::text,null::text where false $$;
create function lumen_privacy.install_guards() returns void language plpgsql as $$
begin
 if not exists(select 1 from lumen_privacy.policy() where rel='activity_mail' and uid_col='owner_id' and action='delete') then
  raise exception 'erasure policy missing';
 end if;
end $$;
