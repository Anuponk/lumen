-- DRAFT ONLY: do not apply to the shared production Supabase project until reviewed.
-- Claim once per signed webhook recipient; ambiguous deliveries remain pending for manual investigation.
create table if not exists public.lumen_auth_mail_deliveries (
  delivery_key text primary key,
  fingerprint text not null,
  state text not null default 'pending' check (state in ('pending','sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text
);
alter table public.lumen_auth_mail_deliveries enable row level security;
revoke all on public.lumen_auth_mail_deliveries from public, anon, authenticated;
grant select,insert,update on public.lumen_auth_mail_deliveries to service_role;

create or replace function public.lumen_auth_mail_claim(p_key text,p_fingerprint text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_row public.lumen_auth_mail_deliveries%rowtype;
begin
  if length(p_key) < 10 or length(p_key) > 256 or length(p_fingerprint) <> 64 then
    raise exception 'invalid delivery key';
  end if;
  insert into public.lumen_auth_mail_deliveries(delivery_key,fingerprint)
    values(p_key,p_fingerprint) on conflict do nothing;
  if found then return 'claimed'; end if;
  select * into v_row from public.lumen_auth_mail_deliveries
    where delivery_key=p_key;
  if not found then return 'pending'; end if;
  if v_row.fingerprint <> p_fingerprint then return 'conflict'; end if;
  if v_row.state='sent' then return 'sent'; end if;
  return 'pending'; -- fail closed: no automatic retry after ambiguous send
end $$;
revoke all on function public.lumen_auth_mail_claim(text,text) from public,anon,authenticated;
grant execute on function public.lumen_auth_mail_claim(text,text) to service_role;

create or replace function public.lumen_auth_mail_mark_sent(p_key text,p_fingerprint text,p_provider_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.lumen_auth_mail_deliveries set state='sent',
    sent_at=coalesce(sent_at,now()),provider_message_id=coalesce(provider_message_id,p_provider_id)
    where delivery_key=p_key and fingerprint=p_fingerprint and state='pending';
  return found;
end $$;
revoke all on function public.lumen_auth_mail_mark_sent(text,text,text) from public,anon,authenticated;
grant execute on function public.lumen_auth_mail_mark_sent(text,text,text) to service_role;
