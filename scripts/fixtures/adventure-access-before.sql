-- Disposable PostgreSQL only. #724: align the minimal fixture tables with the
-- production shape of lumen.entitlements (verified 15/11/2026) before the migration.
alter table lumen.entitlements add column if not exists granted_at timestamptz not null default now();
alter table lumen.entitlements add column if not exists expires_at timestamptz;
alter table lumen.entitlements add column if not exists source text;
delete from lumen.entitlements a using lumen.entitlements b
 where a.ctid<b.ctid and a.user_id=b.user_id and a.entitlement=b.entitlement;
create unique index if not exists entitlements_fixture_key on lumen.entitlements(user_id,entitlement);
alter table lumen.internal_capabilities add column if not exists expires_at timestamptz;
