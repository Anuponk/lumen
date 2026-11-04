-- Adventure 5 publication candidate. No player backfill. Separate authorized activation required.
begin;
-- Catalogue cohort metadata only. No player backfill or reward mutation.
-- catalogue-origin-current: 3
-- Revision IDs refer to immutable content/catalogue/access-origins.json.
create or replace function lumen.protect_catalogue_origin()
returns trigger language plpgsql security invoker set search_path='' as $$
declare origin jsonb; expected_origin jsonb;
begin
 origin:=new.payload->'catalogueOrigin';
 if tg_op='INSERT' and origin is null and
    not exists(select 1 from jsonb_each(coalesce(new.payload->'solved','{}')) e where e.value not in ('false','0','null')) and
    not exists(select 1 from jsonb_each(coalesce(new.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true') then
  new.payload:=jsonb_set(new.payload,'{catalogueOrigin}','3');origin:='3';
 end if;
 if origin is not null and origin not in ('1'::jsonb,'2'::jsonb,'3'::jsonb) then
  raise exception 'Unsupported catalogue origin' using errcode='22023';
 end if;
 if tg_op='UPDATE' then
  expected_origin:=old.payload->'catalogueOrigin';
  if expected_origin is null and origin is null and
     not exists(select 1 from jsonb_each(coalesce(old.payload->'solved','{}')) e where e.value not in ('false','0','null')) and
     not exists(select 1 from jsonb_each(coalesce(old.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true') then
   new.payload:=jsonb_set(new.payload,'{catalogueOrigin}','3');origin:='3';
  end if;
  if expected_origin is not null and origin is distinct from expected_origin then
   raise exception 'Catalogue origin cannot be erased or rewritten' using errcode='23514';
  end if;
  if expected_origin is null and origin is not null then
   expected_origin:=case when
    exists(select 1 from jsonb_each(coalesce(old.payload->'solved','{}')) e where e.value not in ('false','0','null')) or
    exists(select 1 from jsonb_each(coalesce(old.payload->'canonicalQuestState','{}')) e where e.value->'solved'='true')
    then '1'::jsonb else '3'::jsonb end;
   if origin is distinct from expected_origin then
    raise exception 'Catalogue origin disagrees with existing cohort' using errcode='23514';
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function lumen.protect_catalogue_origin() from public,anon,authenticated;

-- BEGIN QUEST RULES
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q001',null,'{"questId":"pack-real-adventure-05-q001","ordinal":401,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q001') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q002',null,'{"questId":"pack-real-adventure-05-q002","ordinal":402,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q002","num":67,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":215,"copy":"Accomplis cette quête en moins de 215 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q002') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q003',null,'{"questId":"pack-real-adventure-05-q003","ordinal":403,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q003') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q004',null,'{"questId":"pack-real-adventure-05-q004","ordinal":404,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q004') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q005',null,'{"questId":"pack-real-adventure-05-q005","ordinal":405,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q005') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q006',null,'{"questId":"pack-real-adventure-05-q006","ordinal":406,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q006') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q007',null,'{"questId":"pack-real-adventure-05-q007","ordinal":407,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q007') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q008',null,'{"questId":"pack-real-adventure-05-q008","ordinal":408,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q008","num":68,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q008') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q009',null,'{"questId":"pack-real-adventure-05-q009","ordinal":409,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q009') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q010',null,'{"questId":"pack-real-adventure-05-q010","ordinal":410,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q010') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q011',null,'{"questId":"pack-real-adventure-05-q011","ordinal":411,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q011') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q012',null,'{"questId":"pack-real-adventure-05-q012","ordinal":412,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q012') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q013',null,'{"questId":"pack-real-adventure-05-q013","ordinal":413,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q013') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q014',null,'{"questId":"pack-real-adventure-05-q014","ordinal":414,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q014","num":69,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q014') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q015',null,'{"questId":"pack-real-adventure-05-q015","ordinal":415,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q015') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q016',null,'{"questId":"pack-real-adventure-05-q016","ordinal":416,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q016') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q017',null,'{"questId":"pack-real-adventure-05-q017","ordinal":417,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q017') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q018',null,'{"questId":"pack-real-adventure-05-q018","ordinal":418,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q018') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q019',null,'{"questId":"pack-real-adventure-05-q019","ordinal":419,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q019') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q020',null,'{"questId":"pack-real-adventure-05-q020","ordinal":420,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q020","num":70,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":225,"copy":"Accomplis cette quête en moins de 225 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q020') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q021',null,'{"questId":"pack-real-adventure-05-q021","ordinal":421,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q021') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q022',null,'{"questId":"pack-real-adventure-05-q022","ordinal":422,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q022') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q023',null,'{"questId":"pack-real-adventure-05-q023","ordinal":423,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q023') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q024',null,'{"questId":"pack-real-adventure-05-q024","ordinal":424,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q024') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q025',null,'{"questId":"pack-real-adventure-05-q025","ordinal":425,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q025') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q026',null,'{"questId":"pack-real-adventure-05-q026","ordinal":426,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q026","num":71,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q026') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q027',null,'{"questId":"pack-real-adventure-05-q027","ordinal":427,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q027') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q028',null,'{"questId":"pack-real-adventure-05-q028","ordinal":428,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q028') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q029',null,'{"questId":"pack-real-adventure-05-q029","ordinal":429,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q029') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q030',null,'{"questId":"pack-real-adventure-05-q030","ordinal":430,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q030') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q031',null,'{"questId":"pack-real-adventure-05-q031","ordinal":431,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q031') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q032',null,'{"questId":"pack-real-adventure-05-q032","ordinal":432,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q032","num":72,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q032') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q033',null,'{"questId":"pack-real-adventure-05-q033","ordinal":433,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q033') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q034',null,'{"questId":"pack-real-adventure-05-q034","ordinal":434,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q034') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q035',null,'{"questId":"pack-real-adventure-05-q035","ordinal":435,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q035') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q036',null,'{"questId":"pack-real-adventure-05-q036","ordinal":436,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q036') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q037',null,'{"questId":"pack-real-adventure-05-q037","ordinal":437,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q037') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q038',null,'{"questId":"pack-real-adventure-05-q038","ordinal":438,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q038","num":73,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":235,"copy":"Accomplis cette quête en moins de 235 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q038') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q039',null,'{"questId":"pack-real-adventure-05-q039","ordinal":439,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q039') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q040',null,'{"questId":"pack-real-adventure-05-q040","ordinal":440,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q040') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q041',null,'{"questId":"pack-real-adventure-05-q041","ordinal":441,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q041') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q042',null,'{"questId":"pack-real-adventure-05-q042","ordinal":442,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q042') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q043',null,'{"questId":"pack-real-adventure-05-q043","ordinal":443,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q043') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q044',null,'{"questId":"pack-real-adventure-05-q044","ordinal":444,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q044","num":74,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q044') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q045',null,'{"questId":"pack-real-adventure-05-q045","ordinal":445,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q045') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q046',null,'{"questId":"pack-real-adventure-05-q046","ordinal":446,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q046') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q047',null,'{"questId":"pack-real-adventure-05-q047","ordinal":447,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q047') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q048',null,'{"questId":"pack-real-adventure-05-q048","ordinal":448,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q048') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q049',null,'{"questId":"pack-real-adventure-05-q049","ordinal":449,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q049') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q050',null,'{"questId":"pack-real-adventure-05-q050","ordinal":450,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q050","num":75,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q050') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q051',null,'{"questId":"pack-real-adventure-05-q051","ordinal":451,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q051') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q052',null,'{"questId":"pack-real-adventure-05-q052","ordinal":452,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q052') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q053',null,'{"questId":"pack-real-adventure-05-q053","ordinal":453,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q053') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q054',null,'{"questId":"pack-real-adventure-05-q054","ordinal":454,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q054') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q055',null,'{"questId":"pack-real-adventure-05-q055","ordinal":455,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q055') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q056',null,'{"questId":"pack-real-adventure-05-q056","ordinal":456,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q056","num":76,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":235,"copy":"Accomplis cette quête en moins de 235 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q056') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q057',null,'{"questId":"pack-real-adventure-05-q057","ordinal":457,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q057') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q058',null,'{"questId":"pack-real-adventure-05-q058","ordinal":458,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q058') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q059',null,'{"questId":"pack-real-adventure-05-q059","ordinal":459,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q059') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q060',null,'{"questId":"pack-real-adventure-05-q060","ordinal":460,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q060') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q061',null,'{"questId":"pack-real-adventure-05-q061","ordinal":461,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q061') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q062',null,'{"questId":"pack-real-adventure-05-q062","ordinal":462,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q062","num":77,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q062') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q063',null,'{"questId":"pack-real-adventure-05-q063","ordinal":463,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q063') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q064',null,'{"questId":"pack-real-adventure-05-q064","ordinal":464,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q064') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q065',null,'{"questId":"pack-real-adventure-05-q065","ordinal":465,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q065') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q066',null,'{"questId":"pack-real-adventure-05-q066","ordinal":466,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q066') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q067',null,'{"questId":"pack-real-adventure-05-q067","ordinal":467,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q067') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q068',null,'{"questId":"pack-real-adventure-05-q068","ordinal":468,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q068","num":78,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q068') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q069',null,'{"questId":"pack-real-adventure-05-q069","ordinal":469,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q069') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q070',null,'{"questId":"pack-real-adventure-05-q070","ordinal":470,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q070') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q071',null,'{"questId":"pack-real-adventure-05-q071","ordinal":471,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q071') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q072',null,'{"questId":"pack-real-adventure-05-q072","ordinal":472,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q072') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q073',null,'{"questId":"pack-real-adventure-05-q073","ordinal":473,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q073') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q074',null,'{"questId":"pack-real-adventure-05-q074","ordinal":474,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q074","num":79,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":245,"copy":"Accomplis cette quête en moins de 245 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q074') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q075',null,'{"questId":"pack-real-adventure-05-q075","ordinal":475,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q075') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q076',null,'{"questId":"pack-real-adventure-05-q076","ordinal":476,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q076') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q077',null,'{"questId":"pack-real-adventure-05-q077","ordinal":477,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q077') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q078',null,'{"questId":"pack-real-adventure-05-q078","ordinal":478,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q078') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q079',null,'{"questId":"pack-real-adventure-05-q079","ordinal":479,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q079') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q080',null,'{"questId":"pack-real-adventure-05-q080","ordinal":480,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q080","num":80,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q080') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q081',null,'{"questId":"pack-real-adventure-05-q081","ordinal":481,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q081') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q082',null,'{"questId":"pack-real-adventure-05-q082","ordinal":482,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q082') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q083',null,'{"questId":"pack-real-adventure-05-q083","ordinal":483,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q083') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q084',null,'{"questId":"pack-real-adventure-05-q084","ordinal":484,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q084') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q085',null,'{"questId":"pack-real-adventure-05-q085","ordinal":485,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q085') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q086',null,'{"questId":"pack-real-adventure-05-q086","ordinal":486,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q086","num":81,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q086') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q087',null,'{"questId":"pack-real-adventure-05-q087","ordinal":487,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q087') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q088',null,'{"questId":"pack-real-adventure-05-q088","ordinal":488,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q088') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q089',null,'{"questId":"pack-real-adventure-05-q089","ordinal":489,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q089') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q090',null,'{"questId":"pack-real-adventure-05-q090","ordinal":490,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q090') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q091',null,'{"questId":"pack-real-adventure-05-q091","ordinal":491,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q091') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q092',null,'{"questId":"pack-real-adventure-05-q092","ordinal":492,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q092","num":82,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":255,"copy":"Accomplis cette quête en moins de 255 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q092') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q093',null,'{"questId":"pack-real-adventure-05-q093","ordinal":493,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q093') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q094',null,'{"questId":"pack-real-adventure-05-q094","ordinal":494,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q094') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q095',null,'{"questId":"pack-real-adventure-05-q095","ordinal":495,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q095') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q096',null,'{"questId":"pack-real-adventure-05-q096","ordinal":496,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q096') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q097',null,'{"questId":"pack-real-adventure-05-q097","ordinal":497,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q097') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q098',null,'{"questId":"pack-real-adventure-05-q098","ordinal":498,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:pack-real-adventure-05-q098","num":83,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q098') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q099',null,'{"questId":"pack-real-adventure-05-q099","ordinal":499,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q099') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-05-q100',null,'{"questId":"pack-real-adventure-05-q100","ordinal":500,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('pack-real-adventure-05-q100') on conflict do nothing;
-- END QUEST RULES
commit;
