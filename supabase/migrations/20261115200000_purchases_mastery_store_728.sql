-- #728: verified purchases and verified mastery grant Adventure entitlements.
-- * Purchases are recorded only by trusted server code (service_role: future Play/Stripe
--   verifiers, #729/#730); the browser can never record or price a purchase.
-- * €5 cap: once confirmed EUR payments reach the "whole real sky" price, every locked
--   Adventure is owned. Refunds/disputes withdraw purchase rights, never progress.
-- * Mastery: a player whose previous Adventure is 100% mastered (every quest, every
--   badge, as recorded by the server) unlocks the next one for free, permanently.
-- * The store seed (Adventures, quest membership, products, badge keys) is generated
--   from the client catalogue: node scripts/adventure-store-seed.mjs --write-seed <this file>.
-- Re-applying this migration is safe.
begin;

create table if not exists lumen_commands.adventure_packs (
 pack_id text primary key,
 sort_order integer not null unique,
 access text not null check (access in ('included','locked'))
);
create table if not exists lumen_commands.quest_packs (
 quest_id text primary key,
 pack_id text not null references lumen_commands.adventure_packs(pack_id),
 legacy_index integer
);
create index if not exists quest_packs_pack_idx on lumen_commands.quest_packs(pack_id);
create table if not exists lumen_commands.store_products (
 product_id text primary key,
 kind text not null check (kind in ('adventure','sky')),
 pack_id text references lumen_commands.adventure_packs(pack_id),
 price_cents integer not null check (price_cents>0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 active boolean not null default true,
 check ((kind='adventure')=(pack_id is not null))
);
create table if not exists lumen_commands.store_settings (
 singleton boolean primary key default true check (singleton),
 cap_cents integer not null check (cap_cents>0),
 badge_keys text[] not null check (cardinality(badge_keys)>0)
);
create table if not exists lumen_commands.purchases (
 id bigint generated always as identity primary key,
 provider text not null check (provider in ('play','stripe')),
 provider_ref text not null check (char_length(provider_ref) between 1 and 200),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references lumen_commands.store_products(product_id),
 amount_cents integer not null check (amount_cents>=0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 status text not null check (status in ('paid','refunded','disputed')),
 purchased_at timestamptz not null,
 updated_at timestamptz not null default clock_timestamp(),
 unique (provider,provider_ref)
);
create index if not exists purchases_user_idx on lumen_commands.purchases(user_id);
create table if not exists lumen_commands.purchase_events (
 id bigint generated always as identity primary key,
 purchase_id bigint not null, -- no FK: both tables are erased by user_id (privacy dependency review)
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check (status in ('paid','refunded','disputed')),
 recorded_at timestamptz not null default clock_timestamp()
);
create index if not exists purchase_events_user_idx on lumen_commands.purchase_events(user_id,recorded_at desc);
do $do$declare t text;begin
 foreach t in array array['adventure_packs','quest_packs','store_products','store_settings','purchases','purchase_events'] loop
  execute format('alter table lumen_commands.%I enable row level security',t);
  execute format('revoke all on lumen_commands.%I from public,anon,authenticated',t);
 end loop;
end $do$;

-- BEGIN STORE SEED
insert into lumen_commands.adventure_packs values ('base-real-sky',0,'included') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-02',1,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-03',2,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-04',3,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-05',4,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-06',5,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-07',6,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-08',7,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.adventure_packs values ('real-adventure-09',8,'locked') on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;
insert into lumen_commands.quest_packs values ('base-q001','base-real-sky',0) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q002','base-real-sky',1) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q003','base-real-sky',2) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q004','base-real-sky',3) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q005','base-real-sky',4) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q006','base-real-sky',5) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-01-q07','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-01-q08','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-01-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-01-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q007','base-real-sky',6) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q008','base-real-sky',7) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q009','base-real-sky',8) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q010','base-real-sky',9) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q011','base-real-sky',10) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q012','base-real-sky',11) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q013','base-real-sky',12) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-02-q08','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-02-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-02-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q014','base-real-sky',13) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q015','base-real-sky',14) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q016','base-real-sky',15) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q017','base-real-sky',16) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q018','base-real-sky',17) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q019','base-real-sky',18) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q020','base-real-sky',19) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-03-q08','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-03-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-03-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q021','base-real-sky',20) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q022','base-real-sky',21) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q023','base-real-sky',22) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q024','base-real-sky',23) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q025','base-real-sky',24) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q026','base-real-sky',25) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q027','base-real-sky',26) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-04-q08','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-04-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-04-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q028','base-real-sky',27) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q029','base-real-sky',28) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q030','base-real-sky',29) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q031','base-real-sky',30) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q032','base-real-sky',31) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q033','base-real-sky',32) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q034','base-real-sky',33) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q035','base-real-sky',34) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-05-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-05-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q036','base-real-sky',35) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q037','base-real-sky',36) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q038','base-real-sky',37) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q039','base-real-sky',38) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q040','base-real-sky',39) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q041','base-real-sky',40) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q042','base-real-sky',41) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q043','base-real-sky',42) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-06-q09','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-06-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q044','base-real-sky',43) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q045','base-real-sky',44) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q046','base-real-sky',45) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q047','base-real-sky',46) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q048','base-real-sky',47) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q049','base-real-sky',48) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q050','base-real-sky',49) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q051','base-real-sky',50) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q052','base-real-sky',51) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-07-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q053','base-real-sky',52) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q054','base-real-sky',53) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q055','base-real-sky',54) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q056','base-real-sky',55) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q057','base-real-sky',56) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q058','base-real-sky',57) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q059','base-real-sky',58) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q060','base-real-sky',59) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q061','base-real-sky',60) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-08-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q062','base-real-sky',61) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q063','base-real-sky',62) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q064','base-real-sky',63) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q065','base-real-sky',64) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q066','base-real-sky',65) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q067','base-real-sky',66) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q068','base-real-sky',67) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q069','base-real-sky',68) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q070','base-real-sky',69) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-09-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q071','base-real-sky',70) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q072','base-real-sky',71) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q073','base-real-sky',72) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q074','base-real-sky',73) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q075','base-real-sky',74) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q076','base-real-sky',75) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q077','base-real-sky',76) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q078','base-real-sky',77) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q079','base-real-sky',78) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-10-q10','base-real-sky',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q080','real-adventure-02',79) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q081','real-adventure-02',80) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q082','real-adventure-02',81) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q083','real-adventure-02',82) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q084','real-adventure-02',83) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q085','real-adventure-02',84) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q086','real-adventure-02',85) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q087','real-adventure-02',86) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q088','real-adventure-02',87) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q089','real-adventure-02',88) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q090','real-adventure-02',89) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q091','real-adventure-02',90) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q092','real-adventure-02',91) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q093','real-adventure-02',92) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q094','real-adventure-02',93) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q095','real-adventure-02',94) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q096','real-adventure-02',95) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q097','real-adventure-02',96) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q098','real-adventure-02',97) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q099','real-adventure-02',98) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q101','real-adventure-02',100) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q102','real-adventure-02',101) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q103','real-adventure-02',102) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q104','real-adventure-02',103) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q105','real-adventure-02',104) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q106','real-adventure-02',105) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q107','real-adventure-02',106) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q108','real-adventure-02',107) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q100','real-adventure-02',99) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-13-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q109','real-adventure-02',108) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q110','real-adventure-02',109) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q111','real-adventure-02',110) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q112','real-adventure-02',111) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q113','real-adventure-02',112) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q114','real-adventure-02',113) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q115','real-adventure-02',114) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q116','real-adventure-02',115) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-14-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-14-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q117','real-adventure-02',116) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q118','real-adventure-02',117) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q119','real-adventure-02',118) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q120','real-adventure-02',119) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q121','real-adventure-02',120) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q122','real-adventure-02',121) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q123','real-adventure-02',122) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q124','real-adventure-02',123) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-15-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-15-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q125','real-adventure-02',124) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q126','real-adventure-02',125) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q127','real-adventure-02',126) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q128','real-adventure-02',127) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q129','real-adventure-02',128) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q130','real-adventure-02',129) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q131','real-adventure-02',130) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q132','real-adventure-02',131) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-16-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-16-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q133','real-adventure-02',132) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q134','real-adventure-02',133) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q135','real-adventure-02',134) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q136','real-adventure-02',135) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q137','real-adventure-02',136) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q138','real-adventure-02',137) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q139','real-adventure-02',138) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q140','real-adventure-02',139) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-17-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-17-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q141','real-adventure-02',140) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q142','real-adventure-02',141) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q143','real-adventure-02',142) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q144','real-adventure-02',143) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q145','real-adventure-02',144) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q146','real-adventure-02',145) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q147','real-adventure-02',146) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q148','real-adventure-02',147) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-18-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-18-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q149','real-adventure-02',148) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q150','real-adventure-02',149) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q151','real-adventure-02',150) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q152','real-adventure-02',151) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q153','real-adventure-02',152) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q154','real-adventure-02',153) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q155','real-adventure-02',154) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q156','real-adventure-02',155) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-19-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-19-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q157','real-adventure-02',156) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q158','real-adventure-02',157) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q159','real-adventure-02',158) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q160','real-adventure-02',159) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q161','real-adventure-02',160) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q162','real-adventure-02',161) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q163','real-adventure-02',162) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q164','real-adventure-02',163) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-20-q09','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-13-q10','real-adventure-02',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q165','real-adventure-03',164) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q166','real-adventure-03',165) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q167','real-adventure-03',166) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q168','real-adventure-03',167) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q169','real-adventure-03',168) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q170','real-adventure-03',169) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q171','real-adventure-03',170) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q172','real-adventure-03',171) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-21-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-21-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q173','real-adventure-03',172) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q174','real-adventure-03',173) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q175','real-adventure-03',174) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q176','real-adventure-03',175) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q177','real-adventure-03',176) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q178','real-adventure-03',177) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q179','real-adventure-03',178) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q180','real-adventure-03',179) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-22-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-22-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q181','real-adventure-03',180) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q182','real-adventure-03',181) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q183','real-adventure-03',182) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q184','real-adventure-03',183) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q185','real-adventure-03',184) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q186','real-adventure-03',185) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q187','real-adventure-03',186) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q188','real-adventure-03',187) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-23-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-23-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q189','real-adventure-03',188) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q190','real-adventure-03',189) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q191','real-adventure-03',190) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q192','real-adventure-03',191) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q193','real-adventure-03',192) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q194','real-adventure-03',193) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q195','real-adventure-03',194) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('base-q196','real-adventure-03',195) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-24-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-24-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-01-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-02-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-03-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-04-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-05-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q01','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q02','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q03','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q04','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q05','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q06','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q07','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q08','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q09','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('planned-real-adventure-03-new-06-q10','real-adventure-03',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q001','real-adventure-04',196) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q002','real-adventure-04',197) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q003','real-adventure-04',198) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q004','real-adventure-04',199) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q005','real-adventure-04',200) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q006','real-adventure-04',201) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q007','real-adventure-04',202) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q008','real-adventure-04',203) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q009','real-adventure-04',204) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q010','real-adventure-04',205) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q011','real-adventure-04',206) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q012','real-adventure-04',207) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q013','real-adventure-04',208) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q014','real-adventure-04',209) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q015','real-adventure-04',210) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q016','real-adventure-04',211) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q017','real-adventure-04',212) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q018','real-adventure-04',213) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q019','real-adventure-04',214) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q020','real-adventure-04',215) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q021','real-adventure-04',216) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q022','real-adventure-04',217) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q023','real-adventure-04',218) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q024','real-adventure-04',219) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q025','real-adventure-04',220) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q026','real-adventure-04',221) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q027','real-adventure-04',222) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q028','real-adventure-04',223) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q029','real-adventure-04',224) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q030','real-adventure-04',225) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q031','real-adventure-04',226) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q032','real-adventure-04',227) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q033','real-adventure-04',228) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q034','real-adventure-04',229) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q035','real-adventure-04',230) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q036','real-adventure-04',231) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q037','real-adventure-04',232) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q038','real-adventure-04',233) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q039','real-adventure-04',234) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q040','real-adventure-04',235) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q041','real-adventure-04',236) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q042','real-adventure-04',237) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q043','real-adventure-04',238) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q044','real-adventure-04',239) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q045','real-adventure-04',240) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q046','real-adventure-04',241) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q047','real-adventure-04',242) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q048','real-adventure-04',243) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q049','real-adventure-04',244) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q050','real-adventure-04',245) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q051','real-adventure-04',246) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q052','real-adventure-04',247) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q053','real-adventure-04',248) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q054','real-adventure-04',249) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q055','real-adventure-04',250) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q056','real-adventure-04',251) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q057','real-adventure-04',252) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q058','real-adventure-04',253) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q059','real-adventure-04',254) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q060','real-adventure-04',255) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q061','real-adventure-04',256) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q062','real-adventure-04',257) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q063','real-adventure-04',258) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q064','real-adventure-04',259) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q065','real-adventure-04',260) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q066','real-adventure-04',261) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q067','real-adventure-04',262) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q068','real-adventure-04',263) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q069','real-adventure-04',264) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q070','real-adventure-04',265) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q071','real-adventure-04',266) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q072','real-adventure-04',267) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q073','real-adventure-04',268) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q074','real-adventure-04',269) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q075','real-adventure-04',270) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q076','real-adventure-04',271) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q077','real-adventure-04',272) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q078','real-adventure-04',273) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q079','real-adventure-04',274) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q080','real-adventure-04',275) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q081','real-adventure-04',276) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q082','real-adventure-04',277) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q083','real-adventure-04',278) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q084','real-adventure-04',279) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q085','real-adventure-04',280) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q086','real-adventure-04',281) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q087','real-adventure-04',282) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q088','real-adventure-04',283) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q089','real-adventure-04',284) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q090','real-adventure-04',285) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q091','real-adventure-04',286) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q092','real-adventure-04',287) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q093','real-adventure-04',288) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q094','real-adventure-04',289) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q095','real-adventure-04',290) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q096','real-adventure-04',291) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q097','real-adventure-04',292) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q098','real-adventure-04',293) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q099','real-adventure-04',294) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-04-q100','real-adventure-04',295) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q001','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q002','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q003','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q004','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q005','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q006','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q007','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q008','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q009','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q010','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q011','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q012','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q013','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q014','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q015','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q016','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q017','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q018','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q019','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q020','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q021','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q022','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q023','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q024','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q025','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q026','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q027','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q028','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q029','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q030','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q031','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q032','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q033','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q034','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q035','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q036','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q037','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q038','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q039','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q040','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q041','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q042','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q043','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q044','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q045','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q046','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q047','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q048','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q049','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q050','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q051','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q052','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q053','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q054','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q055','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q056','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q057','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q058','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q059','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q060','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q061','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q062','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q063','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q064','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q065','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q066','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q067','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q068','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q069','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q070','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q071','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q072','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q073','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q074','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q075','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q076','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q077','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q078','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q079','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q080','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q081','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q082','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q083','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q084','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q085','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q086','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q087','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q088','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q089','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q090','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q091','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q092','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q093','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q094','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q095','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q096','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q097','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q098','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q099','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-05-q100','real-adventure-05',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q001','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q002','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q003','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q004','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q005','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q006','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q007','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q008','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q009','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q010','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q011','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q012','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q013','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q014','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q015','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q016','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q017','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q018','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q019','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q020','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q021','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q022','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q023','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q024','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q025','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q026','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q027','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q028','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q029','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q030','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q031','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q032','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q033','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q034','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q035','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q036','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q037','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q038','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q039','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q040','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q041','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q042','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q043','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q044','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q045','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q046','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q047','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q048','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q049','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q050','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q051','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q052','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q053','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q054','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q055','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q056','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q057','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q058','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q059','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q060','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q061','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q062','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q063','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q064','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q065','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q066','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q067','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q068','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q069','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q070','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q071','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q072','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q073','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q074','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q075','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q076','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q077','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q078','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q079','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q080','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q081','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q082','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q083','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q084','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q085','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q086','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q087','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q088','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q089','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q090','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q091','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q092','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q093','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q094','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q095','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q096','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q097','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q098','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q099','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-06-q100','real-adventure-06',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q001','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q002','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q003','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q004','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q005','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q006','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q007','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q008','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q009','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q010','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q011','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q012','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q013','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q014','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q015','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q016','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q017','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q018','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q019','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q020','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q021','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q022','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q023','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q024','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q025','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q026','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q027','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q028','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q029','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q030','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q031','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q032','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q033','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q034','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q035','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q036','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q037','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q038','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q039','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q040','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q041','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q042','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q043','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q044','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q045','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q046','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q047','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q048','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q049','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q050','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q051','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q052','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q053','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q054','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q055','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q056','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q057','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q058','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q059','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q060','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q061','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q062','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q063','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q064','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q065','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q066','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q067','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q068','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q069','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q070','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q071','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q072','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q073','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q074','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q075','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q076','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q077','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q078','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q079','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q080','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q081','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q082','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q083','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q084','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q085','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q086','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q087','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q088','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q089','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q090','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q091','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q092','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q093','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q094','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q095','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q096','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q097','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q098','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q099','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-07-q100','real-adventure-07',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q001','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q002','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q003','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q004','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q005','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q006','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q007','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q008','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q009','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q010','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q011','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q012','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q013','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q014','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q015','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q016','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q017','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q018','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q019','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q020','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q021','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q022','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q023','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q024','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q025','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q026','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q027','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q028','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q029','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q030','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q031','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q032','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q033','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q034','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q035','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q036','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q037','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q038','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q039','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q040','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q041','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q042','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q043','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q044','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q045','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q046','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q047','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q048','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q049','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q050','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q051','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q052','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q053','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q054','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q055','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q056','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q057','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q058','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q059','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q060','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q061','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q062','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q063','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q064','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q065','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q066','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q067','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q068','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q069','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q070','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q071','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q072','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q073','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q074','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q075','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q076','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q077','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q078','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q079','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q080','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q081','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q082','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q083','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q084','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q085','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q086','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q087','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q088','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q089','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q090','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q091','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q092','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q093','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q094','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q095','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q096','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q097','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q098','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q099','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-08-q100','real-adventure-08',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q001','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q002','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q003','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q004','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q005','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q006','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q007','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q008','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q009','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q010','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q011','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q012','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q013','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q014','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q015','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q016','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q017','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q018','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q019','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q020','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q021','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q022','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q023','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q024','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q025','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q026','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q027','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q028','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q029','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q030','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q031','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q032','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q033','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q034','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q035','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q036','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q037','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q038','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q039','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q040','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q041','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q042','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q043','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q044','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q045','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q046','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q047','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q048','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q049','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q050','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q051','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q052','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q053','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q054','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q055','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q056','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q057','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q058','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q059','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q060','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q061','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q062','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q063','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q064','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q065','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q066','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q067','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q068','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q069','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q070','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q071','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q072','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q073','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q074','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q075','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q076','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q077','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q078','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q079','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.quest_packs values ('pack-real-adventure-09-q080','real-adventure-09',null) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;
insert into lumen_commands.store_products values ('real-adventure-02','adventure','real-adventure-02',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-03','adventure','real-adventure-03',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-04','adventure','real-adventure-04',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-05','adventure','real-adventure-05',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-06','adventure','real-adventure-06',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-07','adventure','real-adventure-07',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-08','adventure','real-adventure-08',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-adventure-09','adventure','real-adventure-09',100,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_products values ('real-sky-all','sky',null,500,'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;
insert into lumen_commands.store_settings values (true,500,array['autonomy','speed','noError','mastery']::text[]) on conflict (singleton) do update set cap_cents=excluded.cap_cents,badge_keys=excluded.badge_keys;
-- END STORE SEED

-- Server view of one Adventure's mastery for one player: quests completed and badges
-- earned, from the server-owned victory projections only (legacy and canonical).
create or replace function lumen_commands.adventure_mastery(p_user uuid,p_pack text)
returns jsonb language sql stable security definer set search_path='' as $$
 with keys as (select badge_keys from lumen_commands.store_settings where singleton),
 legacy as (select projection from lumen_commands.legacy_authority where user_id=p_user),
 quests as (
  select qp.quest_id,
   case when qp.legacy_index is not null
    then (select l.projection->'solved'->(qp.legacy_index::text) from legacy l)
    else (select r.projection->'solved' from lumen_commands.quest_run_authority r where r.user_id=p_user and r.quest_id=qp.quest_id)
   end as solved,
   case when qp.legacy_index is not null
    then (select case when jsonb_typeof(l.projection->'performances'->(qp.legacy_index::text)->'version')='number'
      and (l.projection->'performances'->(qp.legacy_index::text)->>'version')::numeric>=2
      then l.projection->'performances'->(qp.legacy_index::text)->'badges' end from legacy l)
    else (select r.projection->'badges' from lumen_commands.quest_run_authority r where r.user_id=p_user and r.quest_id=qp.quest_id)
   end as badges
  from lumen_commands.quest_packs qp where qp.pack_id=p_pack)
 select jsonb_build_object(
  'quests',count(*),
  'completed',count(*) filter (where q.solved is not null and q.solved not in ('null'::jsonb,'false'::jsonb,'0'::jsonb)),
  'possible',count(*)*coalesce((select cardinality(badge_keys) from keys),0),
  'earned',coalesce(sum((select count(*) from unnest((select badge_keys from keys)) k where q.badges->k='true'::jsonb)),0))
 from quests q;
$$;
revoke all on function lumen_commands.adventure_mastery(uuid,text) from public,anon,authenticated;

-- Converge purchase-sourced entitlements with the confirmed purchases. Rows granted by
-- an administrator or by mastery are never expired here.
create or replace function lumen_commands.sync_purchase_entitlements(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owed text[]; pack text;
begin
 perform pg_advisory_xact_lock(728,hashtext(p_user::text));
 with paid as (
  select s.kind,s.pack_id,p.amount_cents,p.currency from lumen_commands.purchases p
  join lumen_commands.store_products s on s.product_id=p.product_id
  where p.user_id=p_user and p.status='paid')
 select coalesce(array_agg(a.pack_id order by a.pack_id),'{}') into owed
 from lumen_commands.adventure_packs a
 where a.access='locked' and (
  a.pack_id in (select pack_id from paid where kind='adventure')
  or exists(select 1 from paid where kind='sky')
  or coalesce((select sum(amount_cents) from paid where currency='EUR'),0)>=(select cap_cents from lumen_commands.store_settings where singleton));
 foreach pack in array owed loop
  perform pg_advisory_xact_lock(724,hashtext(p_user::text||'/'||pack));
  if not exists(select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=pack
   and (e.expires_at is null or e.expires_at>clock_timestamp())) then
   insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source)
    values(p_user,pack,clock_timestamp(),null,'purchase')
    on conflict(user_id,entitlement) do update set granted_at=excluded.granted_at,expires_at=null,source='purchase';
  end if;
 end loop;
 update lumen.entitlements e set expires_at=clock_timestamp()
  where e.user_id=p_user and e.source='purchase' and (e.expires_at is null or e.expires_at>clock_timestamp())
   and not (e.entitlement=any(owed));
end $$;
revoke all on function lumen_commands.sync_purchase_entitlements(uuid) from public,anon,authenticated;

-- Trusted server code only (payment verifiers). Idempotent per provider purchase id.
create or replace function lumen_commands.record_purchase(
 p_provider text,p_provider_ref text,p_user_id uuid,p_product_id text,p_amount_cents integer,
 p_currency text,p_status text,p_purchased_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r lumen_commands.purchases; changed boolean:=false;
begin
 if p_provider is null or p_provider not in ('play','stripe') then
  raise exception using errcode='22023',message='invalid provider';end if;
 if p_provider_ref is null or char_length(p_provider_ref) not between 1 and 200 then
  raise exception using errcode='22023',message='invalid purchase reference';end if;
 if p_status is null or p_status not in ('paid','refunded','disputed') then
  raise exception using errcode='22023',message='invalid purchase status';end if;
 if p_user_id is null or not exists(select 1 from auth.users a where a.id=p_user_id) then
  raise exception using errcode='22023',message='unknown player';end if;
 if not exists(select 1 from lumen_commands.store_products s where s.product_id=p_product_id) then
  raise exception using errcode='22023',message='unknown product';end if;
 if p_amount_cents is null or p_amount_cents<0 or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
  raise exception using errcode='22023',message='invalid amount';end if;
 perform pg_advisory_xact_lock(728,hashtext(p_user_id::text));
 select * into r from lumen_commands.purchases where provider=p_provider and provider_ref=p_provider_ref for update;
 if not found then
  insert into lumen_commands.purchases(provider,provider_ref,user_id,product_id,amount_cents,currency,status,purchased_at)
   values(p_provider,p_provider_ref,p_user_id,p_product_id,p_amount_cents,p_currency,p_status,coalesce(p_purchased_at,clock_timestamp()))
   returning * into r;
  insert into lumen_commands.purchase_events(purchase_id,user_id,status) values(r.id,r.user_id,r.status);
  changed:=true;
 else
  if r.user_id<>p_user_id or r.product_id<>p_product_id or r.amount_cents<>p_amount_cents or r.currency<>p_currency then
   raise exception using errcode='22023',message='purchase identity conflict';end if;
  if r.status<>p_status then
   update lumen_commands.purchases set status=p_status,updated_at=clock_timestamp() where id=r.id returning * into r;
   insert into lumen_commands.purchase_events(purchase_id,user_id,status) values(r.id,r.user_id,r.status);
   changed:=true;
  end if;
 end if;
 perform lumen_commands.sync_purchase_entitlements(p_user_id);
 return jsonb_build_object('purchase_id',r.id,'status',r.status,'changed',changed,
  'adventures',(select coalesce(jsonb_agg(e.entitlement order by e.entitlement),'[]'::jsonb) from lumen.entitlements e
   where e.user_id=p_user_id and (e.expires_at is null or e.expires_at>clock_timestamp())));
end $$;
revoke all on function lumen_commands.record_purchase(text,text,uuid,text,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function lumen_commands.record_purchase(text,text,uuid,text,integer,text,text,timestamptz) to service_role;

-- The signed-in player asks for the next Adventure after mastering the previous one.
-- The server recomputes mastery; the client only triggers the check.
create or replace function lumen_commands.claim_mastery_unlock(p_expected_user_id uuid,p_adventure text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); target lumen_commands.adventure_packs; previous text; m jsonb; mastered boolean;
 active boolean; changed boolean:=false;
begin
 if u is null or u is distinct from p_expected_user_id then
  raise exception using errcode='42501',message='account mismatch';end if;
 select * into target from lumen_commands.adventure_packs a where a.pack_id=p_adventure and a.access='locked';
 if not found then raise exception using errcode='22023',message='invalid adventure';end if;
 select a.pack_id into previous from lumen_commands.adventure_packs a where a.sort_order<target.sort_order order by a.sort_order desc limit 1;
 if previous is null then raise exception using errcode='22023',message='invalid adventure';end if;
 m:=lumen_commands.adventure_mastery(u,previous);
 mastered:=(m->>'quests')::integer>0 and (m->>'completed')::integer=(m->>'quests')::integer
  and (m->>'earned')::integer=(m->>'possible')::integer;
 if mastered then
  perform pg_advisory_xact_lock(724,hashtext(u::text||'/'||p_adventure));
  select e.expires_at is null or e.expires_at>clock_timestamp() into active
   from lumen.entitlements e where e.user_id=u and e.entitlement=p_adventure;
  if not coalesce(active,false) then
   insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source)
    values(u,p_adventure,clock_timestamp(),null,'mastery')
    on conflict(user_id,entitlement) do update set granted_at=excluded.granted_at,expires_at=null,source='mastery';
   insert into lumen_commands.adventure_access_audit(user_id,actor,adventure,action,reason)
    values(u,u,p_adventure,'grant','Maîtrise à 100 % : '||previous);
   changed:=true;
  end if;
 end if;
 return jsonb_build_object('adventure',p_adventure,'previous',previous,'mastered',mastered,'changed',changed,'mastery',m);
end $$;
revoke all on function lumen_commands.claim_mastery_unlock(uuid,text) from public,anon,authenticated;
grant execute on function lumen_commands.claim_mastery_unlock(uuid,text) to authenticated;
create or replace function public.lumen_claim_mastery_unlock(p_expected_user_id uuid,p_adventure text)
returns jsonb language sql security invoker set search_path='' as $$
 select lumen_commands.claim_mastery_unlock(p_expected_user_id,p_adventure);
$$;
revoke all on function public.lumen_claim_mastery_unlock(uuid,text) from public,anon;
grant execute on function public.lumen_claim_mastery_unlock(uuid,text) to authenticated;

-- Keep inventory, erasure/export and anti-resurrection aware of the new tables.
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null
  and to_regprocedure('lumen_privacy.policy_before_store()') is null then
  alter function lumen_privacy.policy() rename to policy_before_store;
 end if;
 if to_regprocedure('lumen_privacy.policy_before_store()') is not null then
  execute $f$create or replace function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_store()
    union all values
     ('lumen_commands','adventure_packs',null,null,null,'retain-rule'),
     ('lumen_commands','quest_packs',null,null,null,'retain-rule'),
     ('lumen_commands','store_products',null,null,null,'retain-rule'),
     ('lumen_commands','store_settings',null,null,null,'retain-rule'),
     ('lumen_commands','purchases','user_id',null,null,'delete'),
     ('lumen_commands','purchase_events','user_id',null,null,'delete')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_store() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;
notify pgrst,'reload schema';
commit;
