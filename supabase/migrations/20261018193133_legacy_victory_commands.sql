-- #391: opt-in historical victory authority. No player backfill or balance max.
-- Activation is per account, atomically with its first successful command.
create table lumen_commands.legacy_rules (
 quest_id text primary key, legacy_index integer unique not null check(legacy_index>=0),
 rules jsonb not null check(jsonb_typeof(rules)='object')
);
create table lumen_commands.legacy_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id text not null check(operation_id ~ '^[A-Za-z0-9._-]{1,120}$'),
 request jsonb not null, outcome jsonb not null,
 recorded_at timestamptz not null default now(), primary key(user_id,operation_id)
);
create table lumen_commands.legacy_authority (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check(revision>0), projection jsonb not null
);
alter table lumen_commands.legacy_rules enable row level security;
alter table lumen_commands.legacy_receipts enable row level security;
alter table lumen_commands.legacy_authority enable row level security;
revoke all on lumen_commands.legacy_rules,lumen_commands.legacy_receipts,lumen_commands.legacy_authority from public,anon,authenticated;

-- BEGIN CATALOGUE SEED (scripts/legacy-command-fixtures.mjs --write-seed)
insert into lumen_commands.legacy_rules values ('base-q001',0,'{"questId":"base-q001","index":0,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q002',1,'{"questId":"base-q002","index":1,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q003',2,'{"questId":"base-q003","index":2,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q004',3,'{"questId":"base-q004","index":3,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q005',4,'{"questId":"base-q005","index":4,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q006',5,'{"questId":"base-q006","index":5,"campaign":true,"stars":3,"challenge":{"id":"sky2-1","num":1,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":55,"copy":"Accomplis cette quête en moins de 55 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q007',6,'{"questId":"base-q007","index":6,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q008',7,'{"questId":"base-q008","index":7,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q009',8,'{"questId":"base-q009","index":8,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q010',9,'{"questId":"base-q010","index":9,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q011',10,'{"questId":"base-q011","index":10,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q012',11,'{"questId":"base-q012","index":11,"campaign":true,"stars":1,"challenge":{"id":"sky2-2","num":2,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q013',12,'{"questId":"base-q013","index":12,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q014',13,'{"questId":"base-q014","index":13,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q015',14,'{"questId":"base-q015","index":14,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q016',15,'{"questId":"base-q016","index":15,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q017',16,'{"questId":"base-q017","index":16,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q018',17,'{"questId":"base-q018","index":17,"campaign":true,"stars":1,"challenge":{"id":"sky2-3","num":3,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q019',18,'{"questId":"base-q019","index":18,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q020',19,'{"questId":"base-q020","index":19,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q021',20,'{"questId":"base-q021","index":20,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q022',21,'{"questId":"base-q022","index":21,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q023',22,'{"questId":"base-q023","index":22,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q024',23,'{"questId":"base-q024","index":23,"campaign":true,"stars":2,"challenge":{"id":"sky2-4","num":4,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":55,"copy":"Accomplis cette quête en moins de 55 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q025',24,'{"questId":"base-q025","index":24,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q026',25,'{"questId":"base-q026","index":25,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q027',26,'{"questId":"base-q027","index":26,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q028',27,'{"questId":"base-q028","index":27,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q029',28,'{"questId":"base-q029","index":28,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q030',29,'{"questId":"base-q030","index":29,"campaign":true,"stars":1,"challenge":{"id":"sky2-5","num":5,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q031',30,'{"questId":"base-q031","index":30,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q032',31,'{"questId":"base-q032","index":31,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q033',32,'{"questId":"base-q033","index":32,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q034',33,'{"questId":"base-q034","index":33,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q035',34,'{"questId":"base-q035","index":34,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q036',35,'{"questId":"base-q036","index":35,"campaign":true,"stars":2,"challenge":{"id":"sky2-6","num":6,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q037',36,'{"questId":"base-q037","index":36,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q038',37,'{"questId":"base-q038","index":37,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q039',38,'{"questId":"base-q039","index":38,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q040',39,'{"questId":"base-q040","index":39,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q041',40,'{"questId":"base-q041","index":40,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q042',41,'{"questId":"base-q042","index":41,"campaign":true,"stars":1,"challenge":{"id":"sky2-7","num":7,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":65,"copy":"Accomplis cette quête en moins de 65 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q043',42,'{"questId":"base-q043","index":42,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q044',43,'{"questId":"base-q044","index":43,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q045',44,'{"questId":"base-q045","index":44,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q046',45,'{"questId":"base-q046","index":45,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q047',46,'{"questId":"base-q047","index":46,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q048',47,'{"questId":"base-q048","index":47,"campaign":true,"stars":2,"challenge":{"id":"sky2-8","num":8,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q049',48,'{"questId":"base-q049","index":48,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q050',49,'{"questId":"base-q050","index":49,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q051',50,'{"questId":"base-q051","index":50,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q052',51,'{"questId":"base-q052","index":51,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q053',52,'{"questId":"base-q053","index":52,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q054',53,'{"questId":"base-q054","index":53,"campaign":true,"stars":1,"challenge":{"id":"sky2-9","num":9,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q055',54,'{"questId":"base-q055","index":54,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q056',55,'{"questId":"base-q056","index":55,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q057',56,'{"questId":"base-q057","index":56,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q058',57,'{"questId":"base-q058","index":57,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q059',58,'{"questId":"base-q059","index":58,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q060',59,'{"questId":"base-q060","index":59,"campaign":true,"stars":1,"challenge":{"id":"sky2-10","num":10,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":75,"copy":"Accomplis cette quête en moins de 75 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q061',60,'{"questId":"base-q061","index":60,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q062',61,'{"questId":"base-q062","index":61,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q063',62,'{"questId":"base-q063","index":62,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q064',63,'{"questId":"base-q064","index":63,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q065',64,'{"questId":"base-q065","index":64,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q066',65,'{"questId":"base-q066","index":65,"campaign":true,"stars":2,"challenge":{"id":"sky2-11","num":11,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q067',66,'{"questId":"base-q067","index":66,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q068',67,'{"questId":"base-q068","index":67,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q069',68,'{"questId":"base-q069","index":68,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q070',69,'{"questId":"base-q070","index":69,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q071',70,'{"questId":"base-q071","index":70,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q072',71,'{"questId":"base-q072","index":71,"campaign":true,"stars":2,"challenge":{"id":"sky2-12","num":12,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q073',72,'{"questId":"base-q073","index":72,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q074',73,'{"questId":"base-q074","index":73,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q075',74,'{"questId":"base-q075","index":74,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q076',75,'{"questId":"base-q076","index":75,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q077',76,'{"questId":"base-q077","index":76,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q078',77,'{"questId":"base-q078","index":77,"campaign":true,"stars":1,"challenge":{"id":"sky2-13","num":13,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":85,"copy":"Accomplis cette quête en moins de 85 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q079',78,'{"questId":"base-q079","index":78,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q080',79,'{"questId":"base-q080","index":79,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q081',80,'{"questId":"base-q081","index":80,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q082',81,'{"questId":"base-q082","index":81,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q083',82,'{"questId":"base-q083","index":82,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q084',83,'{"questId":"base-q084","index":83,"campaign":true,"stars":2,"challenge":{"id":"sky2-14","num":14,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q085',84,'{"questId":"base-q085","index":84,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q086',85,'{"questId":"base-q086","index":85,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q087',86,'{"questId":"base-q087","index":86,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q088',87,'{"questId":"base-q088","index":87,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q089',88,'{"questId":"base-q089","index":88,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q090',89,'{"questId":"base-q090","index":89,"campaign":true,"stars":2,"challenge":{"id":"sky2-15","num":15,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q091',90,'{"questId":"base-q091","index":90,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q092',91,'{"questId":"base-q092","index":91,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q093',92,'{"questId":"base-q093","index":92,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q094',93,'{"questId":"base-q094","index":93,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q095',94,'{"questId":"base-q095","index":94,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q096',95,'{"questId":"base-q096","index":95,"campaign":true,"stars":1,"challenge":{"id":"sky2-16","num":16,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":85,"copy":"Accomplis cette quête en moins de 85 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q097',96,'{"questId":"base-q097","index":96,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q098',97,'{"questId":"base-q098","index":97,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q099',98,'{"questId":"base-q099","index":98,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q101',100,'{"questId":"base-q101","index":100,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q102',101,'{"questId":"base-q102","index":101,"campaign":true,"stars":1,"challenge":{"id":"sky2-17","num":17,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q103',102,'{"questId":"base-q103","index":102,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q104',103,'{"questId":"base-q104","index":103,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q105',104,'{"questId":"base-q105","index":104,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q106',105,'{"questId":"base-q106","index":105,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q107',106,'{"questId":"base-q107","index":106,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q108',107,'{"questId":"base-q108","index":107,"campaign":true,"stars":3,"challenge":{"id":"sky2-18","num":18,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q100',99,'{"questId":"base-q100","index":99,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q109',108,'{"questId":"base-q109","index":108,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q110',109,'{"questId":"base-q110","index":109,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q111',110,'{"questId":"base-q111","index":110,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q112',111,'{"questId":"base-q112","index":111,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q113',112,'{"questId":"base-q113","index":112,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q114',113,'{"questId":"base-q114","index":113,"campaign":true,"stars":1,"challenge":{"id":"sky2-19","num":19,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":95,"copy":"Accomplis cette quête en moins de 95 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q115',114,'{"questId":"base-q115","index":114,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q116',115,'{"questId":"base-q116","index":115,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q117',116,'{"questId":"base-q117","index":116,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q118',117,'{"questId":"base-q118","index":117,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q119',118,'{"questId":"base-q119","index":118,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q120',119,'{"questId":"base-q120","index":119,"campaign":true,"stars":2,"challenge":{"id":"sky2-20","num":20,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q121',120,'{"questId":"base-q121","index":120,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q122',121,'{"questId":"base-q122","index":121,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q123',122,'{"questId":"base-q123","index":122,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q124',123,'{"questId":"base-q124","index":123,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q125',124,'{"questId":"base-q125","index":124,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q126',125,'{"questId":"base-q126","index":125,"campaign":true,"stars":1,"challenge":{"id":"sky2-21","num":21,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q127',126,'{"questId":"base-q127","index":126,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q128',127,'{"questId":"base-q128","index":127,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q129',128,'{"questId":"base-q129","index":128,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q130',129,'{"questId":"base-q130","index":129,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q131',130,'{"questId":"base-q131","index":130,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q132',131,'{"questId":"base-q132","index":131,"campaign":true,"stars":3,"challenge":{"id":"sky2-22","num":22,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":105,"copy":"Accomplis cette quête en moins de 105 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q133',132,'{"questId":"base-q133","index":132,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q134',133,'{"questId":"base-q134","index":133,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q135',134,'{"questId":"base-q135","index":134,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q136',135,'{"questId":"base-q136","index":135,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q137',136,'{"questId":"base-q137","index":136,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q138',137,'{"questId":"base-q138","index":137,"campaign":true,"stars":1,"challenge":{"id":"sky2-23","num":23,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q139',138,'{"questId":"base-q139","index":138,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q140',139,'{"questId":"base-q140","index":139,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q141',140,'{"questId":"base-q141","index":140,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q142',141,'{"questId":"base-q142","index":141,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q143',142,'{"questId":"base-q143","index":142,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q144',143,'{"questId":"base-q144","index":143,"campaign":true,"stars":1,"challenge":{"id":"sky2-24","num":24,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q145',144,'{"questId":"base-q145","index":144,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q146',145,'{"questId":"base-q146","index":145,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q147',146,'{"questId":"base-q147","index":146,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q148',147,'{"questId":"base-q148","index":147,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q149',148,'{"questId":"base-q149","index":148,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q150',149,'{"questId":"base-q150","index":149,"campaign":true,"stars":2,"challenge":{"id":"sky2-25","num":25,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":115,"copy":"Accomplis cette quête en moins de 115 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q151',150,'{"questId":"base-q151","index":150,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q152',151,'{"questId":"base-q152","index":151,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q153',152,'{"questId":"base-q153","index":152,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q154',153,'{"questId":"base-q154","index":153,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q155',154,'{"questId":"base-q155","index":154,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q156',155,'{"questId":"base-q156","index":155,"campaign":true,"stars":3,"challenge":{"id":"sky2-26","num":26,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q157',156,'{"questId":"base-q157","index":156,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q158',157,'{"questId":"base-q158","index":157,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q159',158,'{"questId":"base-q159","index":158,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q160',159,'{"questId":"base-q160","index":159,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q161',160,'{"questId":"base-q161","index":160,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q162',161,'{"questId":"base-q162","index":161,"campaign":true,"stars":1,"challenge":{"id":"sky2-27","num":27,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q163',162,'{"questId":"base-q163","index":162,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q164',163,'{"questId":"base-q164","index":163,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q165',164,'{"questId":"base-q165","index":164,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q166',165,'{"questId":"base-q166","index":165,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q167',166,'{"questId":"base-q167","index":166,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q168',167,'{"questId":"base-q168","index":167,"campaign":true,"stars":2,"challenge":{"id":"sky2-28","num":28,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":115,"copy":"Accomplis cette quête en moins de 115 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q169',168,'{"questId":"base-q169","index":168,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q170',169,'{"questId":"base-q170","index":169,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q171',170,'{"questId":"base-q171","index":170,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q172',171,'{"questId":"base-q172","index":171,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q173',172,'{"questId":"base-q173","index":172,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q174',173,'{"questId":"base-q174","index":173,"campaign":true,"stars":2,"challenge":{"id":"sky2-29","num":29,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q175',174,'{"questId":"base-q175","index":174,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q176',175,'{"questId":"base-q176","index":175,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q177',176,'{"questId":"base-q177","index":176,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q178',177,'{"questId":"base-q178","index":177,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q179',178,'{"questId":"base-q179","index":178,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q180',179,'{"questId":"base-q180","index":179,"campaign":true,"stars":3,"challenge":{"id":"sky2-30","num":30,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."},"performanceQuest":true,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q181',180,'{"questId":"base-q181","index":180,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q182',181,'{"questId":"base-q182","index":181,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q183',182,'{"questId":"base-q183","index":182,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q184',183,'{"questId":"base-q184","index":183,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q185',184,'{"questId":"base-q185","index":184,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q186',185,'{"questId":"base-q186","index":185,"campaign":true,"stars":1,"challenge":{"id":"sky2-31","num":31,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":125,"copy":"Accomplis cette quête en moins de 125 s. · Marquage auto interdite."},"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q187',186,'{"questId":"base-q187","index":186,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q188',187,'{"questId":"base-q188","index":187,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q189',188,'{"questId":"base-q189","index":188,"campaign":true,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q190',189,'{"questId":"base-q190","index":189,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q191',190,'{"questId":"base-q191","index":190,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q192',191,'{"questId":"base-q192","index":191,"campaign":true,"stars":2,"challenge":{"id":"sky2-32","num":32,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."},"performanceQuest":true,"milestone":"mid","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q193',192,'{"questId":"base-q193","index":192,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q194',193,'{"questId":"base-q194","index":193,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q195',194,'{"questId":"base-q195","index":194,"campaign":true,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('base-q196',195,'{"questId":"base-q196","index":195,"campaign":true,"stars":3,"challenge":null,"performanceQuest":false,"milestone":"boss","campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q001',196,'{"questId":"pack-real-adventure-04-q001","index":196,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q002',197,'{"questId":"pack-real-adventure-04-q002","index":197,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q003',198,'{"questId":"pack-real-adventure-04-q003","index":198,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q004',199,'{"questId":"pack-real-adventure-04-q004","index":199,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q005',200,'{"questId":"pack-real-adventure-04-q005","index":200,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q006',201,'{"questId":"pack-real-adventure-04-q006","index":201,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q007',202,'{"questId":"pack-real-adventure-04-q007","index":202,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q008',203,'{"questId":"pack-real-adventure-04-q008","index":203,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q009',204,'{"questId":"pack-real-adventure-04-q009","index":204,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q010',205,'{"questId":"pack-real-adventure-04-q010","index":205,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q011',206,'{"questId":"pack-real-adventure-04-q011","index":206,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q012',207,'{"questId":"pack-real-adventure-04-q012","index":207,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q013',208,'{"questId":"pack-real-adventure-04-q013","index":208,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q014',209,'{"questId":"pack-real-adventure-04-q014","index":209,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q015',210,'{"questId":"pack-real-adventure-04-q015","index":210,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q016',211,'{"questId":"pack-real-adventure-04-q016","index":211,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q017',212,'{"questId":"pack-real-adventure-04-q017","index":212,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q018',213,'{"questId":"pack-real-adventure-04-q018","index":213,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q019',214,'{"questId":"pack-real-adventure-04-q019","index":214,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q020',215,'{"questId":"pack-real-adventure-04-q020","index":215,"campaign":false,"stars":3,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q021',216,'{"questId":"pack-real-adventure-04-q021","index":216,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q022',217,'{"questId":"pack-real-adventure-04-q022","index":217,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q023',218,'{"questId":"pack-real-adventure-04-q023","index":218,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q024',219,'{"questId":"pack-real-adventure-04-q024","index":219,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q025',220,'{"questId":"pack-real-adventure-04-q025","index":220,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q026',221,'{"questId":"pack-real-adventure-04-q026","index":221,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q027',222,'{"questId":"pack-real-adventure-04-q027","index":222,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q028',223,'{"questId":"pack-real-adventure-04-q028","index":223,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q029',224,'{"questId":"pack-real-adventure-04-q029","index":224,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q030',225,'{"questId":"pack-real-adventure-04-q030","index":225,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q031',226,'{"questId":"pack-real-adventure-04-q031","index":226,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q032',227,'{"questId":"pack-real-adventure-04-q032","index":227,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q033',228,'{"questId":"pack-real-adventure-04-q033","index":228,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q034',229,'{"questId":"pack-real-adventure-04-q034","index":229,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q035',230,'{"questId":"pack-real-adventure-04-q035","index":230,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q036',231,'{"questId":"pack-real-adventure-04-q036","index":231,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q037',232,'{"questId":"pack-real-adventure-04-q037","index":232,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q038',233,'{"questId":"pack-real-adventure-04-q038","index":233,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q039',234,'{"questId":"pack-real-adventure-04-q039","index":234,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q040',235,'{"questId":"pack-real-adventure-04-q040","index":235,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q041',236,'{"questId":"pack-real-adventure-04-q041","index":236,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q042',237,'{"questId":"pack-real-adventure-04-q042","index":237,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q043',238,'{"questId":"pack-real-adventure-04-q043","index":238,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q044',239,'{"questId":"pack-real-adventure-04-q044","index":239,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q045',240,'{"questId":"pack-real-adventure-04-q045","index":240,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q046',241,'{"questId":"pack-real-adventure-04-q046","index":241,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q047',242,'{"questId":"pack-real-adventure-04-q047","index":242,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q048',243,'{"questId":"pack-real-adventure-04-q048","index":243,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q049',244,'{"questId":"pack-real-adventure-04-q049","index":244,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q050',245,'{"questId":"pack-real-adventure-04-q050","index":245,"campaign":false,"stars":3,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q051',246,'{"questId":"pack-real-adventure-04-q051","index":246,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q052',247,'{"questId":"pack-real-adventure-04-q052","index":247,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q053',248,'{"questId":"pack-real-adventure-04-q053","index":248,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q054',249,'{"questId":"pack-real-adventure-04-q054","index":249,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q055',250,'{"questId":"pack-real-adventure-04-q055","index":250,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q056',251,'{"questId":"pack-real-adventure-04-q056","index":251,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q057',252,'{"questId":"pack-real-adventure-04-q057","index":252,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q058',253,'{"questId":"pack-real-adventure-04-q058","index":253,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q059',254,'{"questId":"pack-real-adventure-04-q059","index":254,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q060',255,'{"questId":"pack-real-adventure-04-q060","index":255,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q061',256,'{"questId":"pack-real-adventure-04-q061","index":256,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q062',257,'{"questId":"pack-real-adventure-04-q062","index":257,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q063',258,'{"questId":"pack-real-adventure-04-q063","index":258,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q064',259,'{"questId":"pack-real-adventure-04-q064","index":259,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q065',260,'{"questId":"pack-real-adventure-04-q065","index":260,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q066',261,'{"questId":"pack-real-adventure-04-q066","index":261,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q067',262,'{"questId":"pack-real-adventure-04-q067","index":262,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q068',263,'{"questId":"pack-real-adventure-04-q068","index":263,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q069',264,'{"questId":"pack-real-adventure-04-q069","index":264,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q070',265,'{"questId":"pack-real-adventure-04-q070","index":265,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q071',266,'{"questId":"pack-real-adventure-04-q071","index":266,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q072',267,'{"questId":"pack-real-adventure-04-q072","index":267,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q073',268,'{"questId":"pack-real-adventure-04-q073","index":268,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q074',269,'{"questId":"pack-real-adventure-04-q074","index":269,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q075',270,'{"questId":"pack-real-adventure-04-q075","index":270,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q076',271,'{"questId":"pack-real-adventure-04-q076","index":271,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q077',272,'{"questId":"pack-real-adventure-04-q077","index":272,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q078',273,'{"questId":"pack-real-adventure-04-q078","index":273,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q079',274,'{"questId":"pack-real-adventure-04-q079","index":274,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q080',275,'{"questId":"pack-real-adventure-04-q080","index":275,"campaign":false,"stars":3,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q081',276,'{"questId":"pack-real-adventure-04-q081","index":276,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q082',277,'{"questId":"pack-real-adventure-04-q082","index":277,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q083',278,'{"questId":"pack-real-adventure-04-q083","index":278,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q084',279,'{"questId":"pack-real-adventure-04-q084","index":279,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q085',280,'{"questId":"pack-real-adventure-04-q085","index":280,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q086',281,'{"questId":"pack-real-adventure-04-q086","index":281,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q087',282,'{"questId":"pack-real-adventure-04-q087","index":282,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q088',283,'{"questId":"pack-real-adventure-04-q088","index":283,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q089',284,'{"questId":"pack-real-adventure-04-q089","index":284,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q090',285,'{"questId":"pack-real-adventure-04-q090","index":285,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q091',286,'{"questId":"pack-real-adventure-04-q091","index":286,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q092',287,'{"questId":"pack-real-adventure-04-q092","index":287,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q093',288,'{"questId":"pack-real-adventure-04-q093","index":288,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q094',289,'{"questId":"pack-real-adventure-04-q094","index":289,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q095',290,'{"questId":"pack-real-adventure-04-q095","index":290,"campaign":false,"stars":2,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q096',291,'{"questId":"pack-real-adventure-04-q096","index":291,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q097',292,'{"questId":"pack-real-adventure-04-q097","index":292,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q098',293,'{"questId":"pack-real-adventure-04-q098","index":293,"campaign":false,"stars":1,"challenge":null,"performanceQuest":true,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q099',294,'{"questId":"pack-real-adventure-04-q099","index":294,"campaign":false,"stars":1,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
insert into lumen_commands.legacy_rules values ('pack-real-adventure-04-q100',295,'{"questId":"pack-real-adventure-04-q100","index":295,"campaign":false,"stars":3,"challenge":null,"performanceQuest":false,"milestone":null,"campaignCount":196,"skyTarget":298}'::jsonb);
-- END CATALOGUE SEED

-- Cooldown timestamps remain mutable metadata, never a reward receipt. Other
-- legacy reward fields become command-owned; unrelated daily/spending/preferences
-- and the independent canonical ledger retain their existing writers.
create function lumen_commands.legacy_projection(p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('solved',p->'solved','stars',coalesce(p->'stars','{}'),
  'challenges',coalesce(p->'challenges','{}'),'noHint',coalesce(p->'noHint','{}'),
  'autonomousWins',coalesce(p->'autonomousWins','0'),
  'performances',coalesce((select jsonb_object_agg(key,value-'lastQualifiedAt'-'lastQualifiedDay')
   from jsonb_each(coalesce(p->'performances','{}'))),'{}'));
$$;
create function lumen_commands.protect_legacy_authority() returns trigger
language plpgsql security definer set search_path='' as $$
declare v lumen_commands.legacy_authority%rowtype;
begin
 select * into v from lumen_commands.legacy_authority where user_id=new.user_id;
 if found and ((new.payload->'legacyVictoryRevision') is distinct from to_jsonb(v.revision)
  or lumen_commands.legacy_projection(new.payload) is distinct from v.projection)
 then raise exception using errcode='22023',message='legacy victory command required; preserve pending data and update client'; end if;
 -- XP is cumulative in the existing product (unlike spendable shards).
 -- The independent canonical ledger may add XP; snapshots cannot remove it.
 if found and tg_op='UPDATE' and (jsonb_typeof(new.payload->'xp') is distinct from 'number'
  or (new.payload->>'xp') !~ '^[0-9]{1,15}$'
  or (new.payload->>'xp')::bigint<coalesce((old.payload->>'xp')::bigint,0))
 then raise exception using errcode='22023',message='earned XP cannot decrease';end if;
 return new;
end $$;
create trigger protect_legacy_authority before insert or update of payload on lumen.profile_snapshots
 for each row execute function lumen_commands.protect_legacy_authority();

create function lumen_commands.commit_legacy(p_operation_id text,p_expected_user_id uuid,p_quest_id text,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid(); v_profile jsonb; v_request jsonb; v_rules jsonb;
 v_receipt lumen_commands.legacy_receipts%rowtype; v_index integer; v_key text;
 v_old jsonb; v_badges jsonb; v_run jsonb; v_eligible jsonb; v_saved jsonb; v_outcome jsonb;
 v_first boolean; v_qualified boolean; v_hint boolean; v_assisted boolean; v_wrong boolean;
 v_challenge jsonb; v_pass boolean:=false; v_stars integer:=0; v_seconds integer;
 v_prefix integer:=0; v_campaign_count integer; v_sky integer:=0; v_sky_before integer;
 v_unlocked integer; v_speed boolean; v_autonomy boolean; v_no_error boolean; v_mastery boolean;
 v_xp bigint; v_shards bigint; v_wins bigint; v_auto_shard integer:=0; v_revision bigint;
 v_daily boolean; v_best numeric; v_attempts bigint; v_name text; v_value jsonb;
 v_day date; v_amount integer; v_daily_state jsonb; v_dates jsonb; v_rewards jsonb; v_daily_claim record;
begin
 if v_uid is null or p_expected_user_id is distinct from v_uid
 then raise exception using errcode='42501',message='command account changed'; end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$'
 then raise exception using errcode='22023',message='invalid operation identity'; end if;
 if p_facts is null or jsonb_typeof(p_facts)<>'object' or octet_length(p_facts::text)>2048
  or not (p_facts ?& array['seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'])
  or exists(select 1 from jsonb_object_keys(p_facts) k where k not in ('seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'))
 then raise exception using errcode='22023',message='invalid attempt facts'; end if;
 foreach v_name in array array['assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed'] loop
  if jsonb_typeof(p_facts->v_name)<>'boolean' then raise exception using errcode='22023',message='invalid attempt flag'; end if;
 end loop;
 if jsonb_typeof(p_facts->'seconds')<>'number' or (p_facts->>'seconds') !~ '^[0-9]{1,9}$'
  or jsonb_typeof(p_facts->'qualifiedDay')<>'string' or (p_facts->>'qualifiedDay') !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_facts->'qualifiedAt')<>'string'
 then raise exception using errcode='22023',message='invalid attempt time'; end if;
 perform (p_facts->>'qualifiedDay')::date;
 if not isfinite((p_facts->>'qualifiedAt')::timestamptz) then raise exception using errcode='22023',message='invalid attempt timestamp';end if;
 select rules,legacy_index into v_rules,v_index from lumen_commands.legacy_rules where quest_id=p_quest_id;
 if not found then raise exception using errcode='22023',message='unknown historical quest'; end if;
 v_key:=v_index::text; v_campaign_count:=(v_rules->>'campaignCount')::integer;
 v_request:=jsonb_build_object('version',1,'operationId',p_operation_id,'questId',p_quest_id,'facts',p_facts);
 select payload into v_profile from lumen.profile_snapshots where user_id=v_uid for update;
 if v_profile is null then raise exception using errcode='22023',message='verified cloud profile required'; end if;
 select * into v_receipt from lumen_commands.legacy_receipts where user_id=v_uid and operation_id=p_operation_id;
 if found then
  if v_receipt.request is distinct from v_request then raise exception using errcode='22023',message='operation evidence changed'; end if;
  return jsonb_build_object('profile',v_profile,'request',v_receipt.request,'outcome',v_receipt.outcome,'recordedAt',v_receipt.recorded_at);
 end if;
 -- Refuse unknown/malformed reward data instead of silently repairing it.
 foreach v_name in array array['solved','stars','challenges','performances','noHint','badges'] loop
  if v_profile ? v_name and jsonb_typeof(v_profile->v_name)<>'object'
  then raise exception using errcode='22023',message='historical profile requires review'; end if;
  v_profile:=v_profile||jsonb_build_object(v_name,coalesce(v_profile->v_name,'{}'));
 end loop;
 foreach v_name in array array['xp','shards','autonomousWins','skyScore'] loop
  if v_profile ? v_name and (jsonb_typeof(v_profile->v_name)<>'number' or (v_profile->>v_name) !~ '^[0-9]{1,15}$')
  then raise exception using errcode='22023',message='historical balance requires review'; end if;
 end loop;
 v_old:=coalesce(v_profile->'performances'->v_key,'{}');
 if jsonb_typeof(v_old)<>'object' or (v_old ? 'version' and v_old->>'version' not in ('1','2','3'))
 then raise exception using errcode='22023',message='performance schema requires review'; end if;
 if v_old ? 'badges' and jsonb_typeof(v_old->'badges')<>'object'
 then raise exception using errcode='22023',message='performance badges require review'; end if;
 v_seconds:=(p_facts->>'seconds')::integer; v_qualified:=(p_facts->>'qualifying')::boolean;
 v_hint:=(p_facts->>'hintUsed')::boolean; v_assisted:=(p_facts->>'assistanceUsed')::boolean; v_wrong:=(p_facts->>'mistakeCommitted')::boolean;
 v_first:=coalesce(v_profile->'solved'->>v_key,'0') not in ('true','1');
 -- Same legacy solved-prefix eligibility and sky-history repair as progression.js.
 while v_prefix<v_campaign_count and coalesce(v_profile->'solved'->>v_prefix::text,'0') in ('true','1') loop
  v_sky:=v_sky+coalesce((select (rules->>'stars')::integer from lumen_commands.legacy_rules where legacy_index=v_prefix),0);v_prefix:=v_prefix+1;
 end loop;
 v_sky:=least((v_rules->>'skyTarget')::integer,v_sky);
 v_sky_before:=case when v_profile->>'skyHistoryVersion'='4' then least((v_rules->>'skyTarget')::integer,greatest(coalesce((v_profile->>'skyScore')::bigint,0),v_sky)) else v_sky end;
 v_profile:=v_profile||jsonb_build_object('skyScore',v_sky_before,'skyHistoryVersion',4);
 v_profile:=jsonb_set(v_profile,array['solved',v_key],'1');
 v_xp:=coalesce((v_profile->>'xp')::bigint,0); v_shards:=coalesce((v_profile->>'shards')::bigint,0);v_wins:=coalesce((v_profile->>'autonomousWins')::bigint,0);
 if v_first then
  v_stars:=(v_rules->>'stars')::integer;v_xp:=v_xp+10+case when v_hint then 0 else 5 end;
  if (v_rules->>'campaign')::boolean then v_profile:=jsonb_set(v_profile,'{skyScore}',to_jsonb(least((v_rules->>'skyTarget')::integer,v_sky_before+v_stars))); end if;
 end if;
 v_challenge:=v_rules->'challenge';
 if jsonb_typeof(v_challenge)='object' and coalesce(v_profile->'stars'->>(v_challenge->>'id'),'0') not in ('1','true') then
  v_pass:=not (p_facts->>'challengeFailed')::boolean and case when v_challenge->>'seconds' is not null then v_seconds<=(v_challenge->>'seconds')::integer when v_challenge->>'type'='2' then not v_hint else true end;
  if v_pass then
   v_profile:=jsonb_set(v_profile,array['stars',v_challenge->>'id'],'1');
   v_profile:=jsonb_set(v_profile,array['challenges',v_challenge->>'id'],'1');v_xp:=v_xp+25;v_shards:=v_shards+1;
  end if;
 end if;
 -- Eligibility is evaluated after solved[] changes, exactly like savePerformance.
 v_prefix:=0;
 while v_prefix<v_campaign_count and coalesce(v_profile->'solved'->>v_prefix::text,'0') in ('true','1') loop v_prefix:=v_prefix+1; end loop;
 v_unlocked:=greatest(v_index+1,v_prefix);
 v_eligible:=jsonb_build_object('speed',v_index+1>=3 or v_unlocked>=3,'autonomy',v_index+1>=6 or v_unlocked>=6,'noError',v_index+1>=6 or v_unlocked>=6,'mastery',v_index+1>=6 or v_unlocked>=6);
 v_speed:=(v_eligible->>'speed')::boolean and v_seconds<60;
 v_autonomy:=(v_eligible->>'autonomy')::boolean and not v_assisted;
 v_no_error:=(v_eligible->>'noError')::boolean and not v_assisted and not v_wrong;
 v_mastery:=(v_eligible->>'mastery')::boolean and v_autonomy and v_speed and v_no_error;
 v_run:=jsonb_build_object('eligibility',v_eligible,'autonomy',v_autonomy,'speed',v_speed,'noError',v_no_error,'mastery',v_mastery,'targetSeconds',60,'qualifying',v_qualified);
 v_badges:=case when coalesce((v_old->>'version')::integer,1)>=2 then coalesce(v_old->'badges','{}') else '{}' end;
 foreach v_name in array array['autonomy','speed','noError','mastery'] loop
  v_badges:=jsonb_set(v_badges,array[v_name],to_jsonb(coalesce(v_badges->>v_name,'false') in ('true','1') or (v_qualified and (v_run->>v_name)::boolean)));
 end loop;
 if v_old ? 'bestTime' and jsonb_typeof(v_old->'bestTime') not in ('number','null') then raise exception using errcode='22023',message='best time requires review'; end if;
 v_best:=least(coalesce((v_old->>'bestTime')::numeric,v_seconds),v_seconds);
 foreach v_name in array array['attempts','stars'] loop
  if v_old ? v_name and (jsonb_typeof(v_old->v_name)<>'number' or (v_old->>v_name) !~ '^[0-9]{1,15}$') then raise exception using errcode='22023',message='performance counter requires review'; end if;
 end loop;
 v_attempts:=coalesce((v_old->>'attempts')::bigint,0)+1;
 v_saved:=v_old||jsonb_build_object('version',3,'questIndex',v_index,'badges',v_badges,'bestTime',v_best,'time',v_best,'stars',greatest(coalesce((v_old->>'stars')::bigint,0),v_stars),'quest',v_rules->'performanceQuest','milestone',v_rules->'milestone','attempts',v_attempts,
  'lastQualifiedDay',case when v_qualified then p_facts->'qualifiedDay' else coalesce(v_old->'lastQualifiedDay','null') end,
  'lastQualifiedAt',case when v_qualified then coalesce(nullif(v_old->'lastQualifiedAt','null'),p_facts->'qualifiedAt') else coalesce(v_old->'lastQualifiedAt','null') end);
 v_profile:=jsonb_set(v_profile,array['performances',v_key],v_saved);
 if v_first and v_autonomy then v_wins:=v_wins+1;if v_wins%3=0 then v_auto_shard:=1;v_shards:=v_shards+1;end if;v_profile:=v_profile||jsonb_build_object('autonomousWins',v_wins);end if;
 if not v_hint then v_profile:=jsonb_set(v_profile,array['noHint',v_key],'1');end if;
 v_daily:=v_first or (v_qualified and exists(select 1 from jsonb_each(v_badges) b where b.key in ('autonomy','speed','noError','mastery') and b.value='true' and coalesce((case when coalesce((v_old->>'version')::integer,1)>=2 then v_old->'badges' else '{}' end)->>b.key,'false') not in ('true','1')));
 -- Existing authoritative Paris calendar/streak RPC participates in THIS
 -- transaction. A response loss/restart cannot drop a day's claim or credit it
 -- twice. Lock order: profile -> engagement. Never copy its separate balance.
 if v_daily then
  select * into v_daily_claim from public.lumen_claim_daily(v_index+1);
  v_daily_state:=coalesce(v_profile->'daily','{}');
  v_dates:=coalesce(v_daily_state->'dates','{}');v_rewards:=coalesce(v_daily_state->'rewards','{}');
  for v_day in select play_date from lumen.daily_progress where user_id=v_uid loop v_dates:=v_dates||jsonb_build_object(v_day::text,1);end loop;
  for v_name,v_value in select key,value from jsonb_each((select rewarded_days from lumen.engagement_state where user_id=v_uid)) loop
   v_amount:=(v_value::text)::integer;
   if v_amount>0 and not(v_rewards ? ('streak:'||v_name)) then v_shards:=v_shards+v_amount;v_rewards:=v_rewards||jsonb_build_object('streak:'||v_name,v_amount);end if;
  end loop;
  v_profile:=v_profile||jsonb_build_object('daily',v_daily_state||jsonb_build_object('dates',v_dates,'rewards',v_rewards));
 end if;
 v_profile:=v_profile||jsonb_build_object('xp',v_xp,'shards',v_shards);
 v_outcome:=jsonb_build_object('firstCompletion',v_first,'questPassed',v_pass,'stars',v_stars,'skyEarnedBefore',v_sky_before,'priorPerformance',v_old,'priorBadges',case when coalesce((v_old->>'version')::integer,1)>=2 then coalesce(v_old->'badges','{}') else '{}' end,'savedPerformance',jsonb_build_object('run',v_run,'qualifying',v_qualified,'badges',v_badges),'autonomyShard',v_auto_shard,'dailyQualified',v_daily,'attempts',v_attempts);
 -- The authority row is not client-writable. Updating it BEFORE the snapshot
 -- permits only this exact reward projection through the shared trigger.
 insert into lumen_commands.legacy_authority(user_id,revision,projection) values(v_uid,1,lumen_commands.legacy_projection(v_profile))
 on conflict(user_id) do update set revision=lumen_commands.legacy_authority.revision+1,projection=excluded.projection returning revision into v_revision;
 v_profile:=v_profile||jsonb_build_object('legacyVictoryRevision',v_revision);
 update lumen.profile_snapshots set payload=v_profile,saved_at=now() where user_id=v_uid;
 -- Same numeric mirror, now inside the reward/receipt transaction.
 perform public.lumen_save_progress(v_index+1,v_seconds,case when v_hint then 1 else 0 end);
 insert into lumen_commands.legacy_receipts(user_id,operation_id,request,outcome) values(v_uid,p_operation_id,v_request,v_outcome) returning * into v_receipt;
 return jsonb_build_object('profile',v_profile,'request',v_receipt.request,'outcome',v_receipt.outcome,'recordedAt',v_receipt.recorded_at);
end $$;

create function lumen_commands.get_legacy(p_operation_id text,p_expected_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r lumen_commands.legacy_receipts%rowtype;u uuid:=auth.uid();
begin
 if u is null or p_expected_user_id is distinct from u then raise exception using errcode='42501',message='command account changed';end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$' then raise exception using errcode='22023',message='invalid operation identity';end if;
 select * into r from lumen_commands.legacy_receipts where user_id=u and operation_id=p_operation_id;
 if not found then return null;end if;
 return jsonb_build_object('request',r.request,'outcome',r.outcome,'recordedAt',r.recorded_at);
end $$;
create function public.lumen_commit_legacy_command(p_operation_id text,p_expected_user_id uuid,p_quest_id text,p_facts jsonb) returns jsonb
language sql security invoker set search_path='' as $$select lumen_commands.commit_legacy(p_operation_id,p_expected_user_id,p_quest_id,p_facts);$$;
create function public.lumen_get_legacy_command(p_operation_id text,p_expected_user_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select lumen_commands.get_legacy(p_operation_id,p_expected_user_id);$$;
create function public.lumen_legacy_command_version() returns integer language plpgsql stable security invoker set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='authentication required';end if;return 1;end $$;
revoke all on function lumen_commands.legacy_projection(jsonb),lumen_commands.protect_legacy_authority() from public,anon,authenticated;
revoke all on function lumen_commands.commit_legacy(text,uuid,text,jsonb),lumen_commands.get_legacy(text,uuid) from public,anon;
grant execute on function lumen_commands.commit_legacy(text,uuid,text,jsonb),lumen_commands.get_legacy(text,uuid) to authenticated;
revoke all on function public.lumen_commit_legacy_command(text,uuid,text,jsonb),public.lumen_get_legacy_command(text,uuid),public.lumen_legacy_command_version() from public,anon;
grant execute on function public.lumen_commit_legacy_command(text,uuid,text,jsonb),public.lumen_get_legacy_command(text,uuid),public.lumen_legacy_command_version() to authenticated;
notify pgrst,'reload schema';
