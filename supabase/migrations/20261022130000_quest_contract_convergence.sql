-- #522: additive versioned quest commands. No player backfill or retroactive grant.
-- Apply only after disposable SQL/concurrency tests and separate owner approval.
create table lumen_commands.quest_rules (
 quest_id text primary key, legacy_index integer unique, rules jsonb not null
);
alter table lumen_commands.quest_rules enable row level security;
revoke all on lumen_commands.quest_rules from public,anon,authenticated;
-- BEGIN QUEST RULES
insert into lumen_commands.quest_rules values ('base-q001',0,'{"questId":"base-q001","ordinal":1,"legacyIndex":0,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q002',1,'{"questId":"base-q002","ordinal":2,"legacyIndex":1,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q003',2,'{"questId":"base-q003","ordinal":3,"legacyIndex":2,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q004',3,'{"questId":"base-q004","ordinal":4,"legacyIndex":3,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q005',4,'{"questId":"base-q005","ordinal":5,"legacyIndex":4,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q006',5,'{"questId":"base-q006","ordinal":6,"legacyIndex":5,"stars":3,"bonus":{"id":"sky2-1","num":1,"type":1,"noAuto":false,"title":"⚡ Défi Éclair","seconds":55,"copy":"Accomplis cette quête en moins de 55 s."}}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-01-q07',null,'{"questId":"planned-real-01-q07","ordinal":7,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-01-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-01-q08',null,'{"questId":"planned-real-01-q08","ordinal":8,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-01-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-01-q09',null,'{"questId":"planned-real-01-q09","ordinal":9,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-01-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-01-q10',null,'{"questId":"planned-real-01-q10","ordinal":10,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-01-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q007',6,'{"questId":"base-q007","ordinal":11,"legacyIndex":6,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q008',7,'{"questId":"base-q008","ordinal":12,"legacyIndex":7,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q009',8,'{"questId":"base-q009","ordinal":13,"legacyIndex":8,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q010',9,'{"questId":"base-q010","ordinal":14,"legacyIndex":9,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q011',10,'{"questId":"base-q011","ordinal":15,"legacyIndex":10,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q012',11,'{"questId":"base-q012","ordinal":16,"legacyIndex":11,"stars":1,"bonus":{"id":"sky2-2","num":2,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q013',12,'{"questId":"base-q013","ordinal":17,"legacyIndex":12,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-02-q08',null,'{"questId":"planned-real-02-q08","ordinal":18,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-02-q08","num":3,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-02-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-02-q09',null,'{"questId":"planned-real-02-q09","ordinal":19,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-02-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-02-q10',null,'{"questId":"planned-real-02-q10","ordinal":20,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-02-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q014',13,'{"questId":"base-q014","ordinal":21,"legacyIndex":13,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q015',14,'{"questId":"base-q015","ordinal":22,"legacyIndex":14,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q016',15,'{"questId":"base-q016","ordinal":23,"legacyIndex":15,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q017',16,'{"questId":"base-q017","ordinal":24,"legacyIndex":16,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q018',17,'{"questId":"base-q018","ordinal":25,"legacyIndex":17,"stars":1,"bonus":{"id":"sky2-3","num":3,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q019',18,'{"questId":"base-q019","ordinal":26,"legacyIndex":18,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q020',19,'{"questId":"base-q020","ordinal":27,"legacyIndex":19,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-03-q08',null,'{"questId":"planned-real-03-q08","ordinal":28,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-03-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-03-q09',null,'{"questId":"planned-real-03-q09","ordinal":29,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-03-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-03-q10',null,'{"questId":"planned-real-03-q10","ordinal":30,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-03-q10","num":5,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-03-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q021',20,'{"questId":"base-q021","ordinal":31,"legacyIndex":20,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q022',21,'{"questId":"base-q022","ordinal":32,"legacyIndex":21,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q023',22,'{"questId":"base-q023","ordinal":33,"legacyIndex":22,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q024',23,'{"questId":"base-q024","ordinal":34,"legacyIndex":23,"stars":2,"bonus":{"id":"sky2-4","num":4,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":55,"copy":"Accomplis cette quête en moins de 55 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q025',24,'{"questId":"base-q025","ordinal":35,"legacyIndex":24,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q026',25,'{"questId":"base-q026","ordinal":36,"legacyIndex":25,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q027',26,'{"questId":"base-q027","ordinal":37,"legacyIndex":26,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-04-q08',null,'{"questId":"planned-real-04-q08","ordinal":38,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-04-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-04-q09',null,'{"questId":"planned-real-04-q09","ordinal":39,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-04-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-04-q10',null,'{"questId":"planned-real-04-q10","ordinal":40,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-04-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q028',27,'{"questId":"base-q028","ordinal":41,"legacyIndex":27,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q029',28,'{"questId":"base-q029","ordinal":42,"legacyIndex":28,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q030',29,'{"questId":"base-q030","ordinal":43,"legacyIndex":29,"stars":1,"bonus":{"id":"sky2-5","num":5,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q031',30,'{"questId":"base-q031","ordinal":44,"legacyIndex":30,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q032',31,'{"questId":"base-q032","ordinal":45,"legacyIndex":31,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q033',32,'{"questId":"base-q033","ordinal":46,"legacyIndex":32,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q034',33,'{"questId":"base-q034","ordinal":47,"legacyIndex":33,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q035',34,'{"questId":"base-q035","ordinal":48,"legacyIndex":34,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-05-q09',null,'{"questId":"planned-real-05-q09","ordinal":49,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-05-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-05-q10',null,'{"questId":"planned-real-05-q10","ordinal":50,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-05-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q036',35,'{"questId":"base-q036","ordinal":51,"legacyIndex":35,"stars":2,"bonus":{"id":"sky2-6","num":6,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q037',36,'{"questId":"base-q037","ordinal":52,"legacyIndex":36,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q038',37,'{"questId":"base-q038","ordinal":53,"legacyIndex":37,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q039',38,'{"questId":"base-q039","ordinal":54,"legacyIndex":38,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q040',39,'{"questId":"base-q040","ordinal":55,"legacyIndex":39,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q041',40,'{"questId":"base-q041","ordinal":56,"legacyIndex":40,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q042',41,'{"questId":"base-q042","ordinal":57,"legacyIndex":41,"stars":1,"bonus":{"id":"sky2-7","num":7,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":65,"copy":"Accomplis cette quête en moins de 65 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q043',42,'{"questId":"base-q043","ordinal":58,"legacyIndex":42,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-06-q09',null,'{"questId":"planned-real-06-q09","ordinal":59,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-06-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-06-q10',null,'{"questId":"planned-real-06-q10","ordinal":60,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-06-q10","num":10,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":75,"copy":"Accomplis cette quête en moins de 75 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-06-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q044',43,'{"questId":"base-q044","ordinal":61,"legacyIndex":43,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q045',44,'{"questId":"base-q045","ordinal":62,"legacyIndex":44,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q046',45,'{"questId":"base-q046","ordinal":63,"legacyIndex":45,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q047',46,'{"questId":"base-q047","ordinal":64,"legacyIndex":46,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q048',47,'{"questId":"base-q048","ordinal":65,"legacyIndex":47,"stars":2,"bonus":{"id":"sky2-8","num":8,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q049',48,'{"questId":"base-q049","ordinal":66,"legacyIndex":48,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q050',49,'{"questId":"base-q050","ordinal":67,"legacyIndex":49,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q051',50,'{"questId":"base-q051","ordinal":68,"legacyIndex":50,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q052',51,'{"questId":"base-q052","ordinal":69,"legacyIndex":51,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-07-q10',null,'{"questId":"planned-real-07-q10","ordinal":70,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-07-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q053',52,'{"questId":"base-q053","ordinal":71,"legacyIndex":52,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q054',53,'{"questId":"base-q054","ordinal":72,"legacyIndex":53,"stars":1,"bonus":{"id":"sky2-9","num":9,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q055',54,'{"questId":"base-q055","ordinal":73,"legacyIndex":54,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q056',55,'{"questId":"base-q056","ordinal":74,"legacyIndex":55,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q057',56,'{"questId":"base-q057","ordinal":75,"legacyIndex":56,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q058',57,'{"questId":"base-q058","ordinal":76,"legacyIndex":57,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q059',58,'{"questId":"base-q059","ordinal":77,"legacyIndex":58,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q060',59,'{"questId":"base-q060","ordinal":78,"legacyIndex":59,"stars":1,"bonus":{"id":"sky2-10","num":10,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":75,"copy":"Accomplis cette quête en moins de 75 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q061',60,'{"questId":"base-q061","ordinal":79,"legacyIndex":60,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-08-q10',null,'{"questId":"planned-real-08-q10","ordinal":80,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-08-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q062',61,'{"questId":"base-q062","ordinal":81,"legacyIndex":61,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q063',62,'{"questId":"base-q063","ordinal":82,"legacyIndex":62,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q064',63,'{"questId":"base-q064","ordinal":83,"legacyIndex":63,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q065',64,'{"questId":"base-q065","ordinal":84,"legacyIndex":64,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q066',65,'{"questId":"base-q066","ordinal":85,"legacyIndex":65,"stars":2,"bonus":{"id":"sky2-11","num":11,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q067',66,'{"questId":"base-q067","ordinal":86,"legacyIndex":66,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q068',67,'{"questId":"base-q068","ordinal":87,"legacyIndex":67,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q069',68,'{"questId":"base-q069","ordinal":88,"legacyIndex":68,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q070',69,'{"questId":"base-q070","ordinal":89,"legacyIndex":69,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-09-q10',null,'{"questId":"planned-real-09-q10","ordinal":90,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-09-q10","num":15,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-09-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q071',70,'{"questId":"base-q071","ordinal":91,"legacyIndex":70,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q072',71,'{"questId":"base-q072","ordinal":92,"legacyIndex":71,"stars":2,"bonus":{"id":"sky2-12","num":12,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q073',72,'{"questId":"base-q073","ordinal":93,"legacyIndex":72,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q074',73,'{"questId":"base-q074","ordinal":94,"legacyIndex":73,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q075',74,'{"questId":"base-q075","ordinal":95,"legacyIndex":74,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q076',75,'{"questId":"base-q076","ordinal":96,"legacyIndex":75,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q077',76,'{"questId":"base-q077","ordinal":97,"legacyIndex":76,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q078',77,'{"questId":"base-q078","ordinal":98,"legacyIndex":77,"stars":1,"bonus":{"id":"sky2-13","num":13,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":85,"copy":"Accomplis cette quête en moins de 85 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q079',78,'{"questId":"base-q079","ordinal":99,"legacyIndex":78,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-10-q10',null,'{"questId":"planned-real-10-q10","ordinal":100,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-10-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q080',79,'{"questId":"base-q080","ordinal":101,"legacyIndex":79,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q081',80,'{"questId":"base-q081","ordinal":102,"legacyIndex":80,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q082',81,'{"questId":"base-q082","ordinal":103,"legacyIndex":81,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q083',82,'{"questId":"base-q083","ordinal":104,"legacyIndex":82,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q084',83,'{"questId":"base-q084","ordinal":105,"legacyIndex":83,"stars":2,"bonus":{"id":"sky2-14","num":14,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q085',84,'{"questId":"base-q085","ordinal":106,"legacyIndex":84,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q086',85,'{"questId":"base-q086","ordinal":107,"legacyIndex":85,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q087',86,'{"questId":"base-q087","ordinal":108,"legacyIndex":86,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q088',87,'{"questId":"base-q088","ordinal":109,"legacyIndex":87,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q089',88,'{"questId":"base-q089","ordinal":110,"legacyIndex":88,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q090',89,'{"questId":"base-q090","ordinal":111,"legacyIndex":89,"stars":2,"bonus":{"id":"sky2-15","num":15,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q091',90,'{"questId":"base-q091","ordinal":112,"legacyIndex":90,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q092',91,'{"questId":"base-q092","ordinal":113,"legacyIndex":91,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q093',92,'{"questId":"base-q093","ordinal":114,"legacyIndex":92,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q094',93,'{"questId":"base-q094","ordinal":115,"legacyIndex":93,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q095',94,'{"questId":"base-q095","ordinal":116,"legacyIndex":94,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q096',95,'{"questId":"base-q096","ordinal":117,"legacyIndex":95,"stars":1,"bonus":{"id":"sky2-16","num":16,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":85,"copy":"Accomplis cette quête en moins de 85 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q097',96,'{"questId":"base-q097","ordinal":118,"legacyIndex":96,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q098',97,'{"questId":"base-q098","ordinal":119,"legacyIndex":97,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q099',98,'{"questId":"base-q099","ordinal":120,"legacyIndex":98,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q101',100,'{"questId":"base-q101","ordinal":121,"legacyIndex":100,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q102',101,'{"questId":"base-q102","ordinal":122,"legacyIndex":101,"stars":1,"bonus":{"id":"sky2-17","num":17,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q103',102,'{"questId":"base-q103","ordinal":123,"legacyIndex":102,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q104',103,'{"questId":"base-q104","ordinal":124,"legacyIndex":103,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q105',104,'{"questId":"base-q105","ordinal":125,"legacyIndex":104,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q106',105,'{"questId":"base-q106","ordinal":126,"legacyIndex":105,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q107',106,'{"questId":"base-q107","ordinal":127,"legacyIndex":106,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q108',107,'{"questId":"base-q108","ordinal":128,"legacyIndex":107,"stars":3,"bonus":{"id":"sky2-18","num":18,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q100',99,'{"questId":"base-q100","ordinal":129,"legacyIndex":99,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-13-q09',null,'{"questId":"planned-real-13-q09","ordinal":130,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-13-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q109',108,'{"questId":"base-q109","ordinal":131,"legacyIndex":108,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q110',109,'{"questId":"base-q110","ordinal":132,"legacyIndex":109,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q111',110,'{"questId":"base-q111","ordinal":133,"legacyIndex":110,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q112',111,'{"questId":"base-q112","ordinal":134,"legacyIndex":111,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q113',112,'{"questId":"base-q113","ordinal":135,"legacyIndex":112,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q114',113,'{"questId":"base-q114","ordinal":136,"legacyIndex":113,"stars":1,"bonus":{"id":"sky2-19","num":19,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":95,"copy":"Accomplis cette quête en moins de 95 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q115',114,'{"questId":"base-q115","ordinal":137,"legacyIndex":114,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q116',115,'{"questId":"base-q116","ordinal":138,"legacyIndex":115,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-14-q09',null,'{"questId":"planned-real-14-q09","ordinal":139,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-14-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-14-q10',null,'{"questId":"planned-real-14-q10","ordinal":140,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-14-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q117',116,'{"questId":"base-q117","ordinal":141,"legacyIndex":116,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q118',117,'{"questId":"base-q118","ordinal":142,"legacyIndex":117,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q119',118,'{"questId":"base-q119","ordinal":143,"legacyIndex":118,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q120',119,'{"questId":"base-q120","ordinal":144,"legacyIndex":119,"stars":2,"bonus":{"id":"sky2-20","num":20,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q121',120,'{"questId":"base-q121","ordinal":145,"legacyIndex":120,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q122',121,'{"questId":"base-q122","ordinal":146,"legacyIndex":121,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q123',122,'{"questId":"base-q123","ordinal":147,"legacyIndex":122,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q124',123,'{"questId":"base-q124","ordinal":148,"legacyIndex":123,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-15-q09',null,'{"questId":"planned-real-15-q09","ordinal":149,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-15-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-15-q10',null,'{"questId":"planned-real-15-q10","ordinal":150,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-15-q10","num":25,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":115,"copy":"Accomplis cette quête en moins de 115 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-15-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q125',124,'{"questId":"base-q125","ordinal":151,"legacyIndex":124,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q126',125,'{"questId":"base-q126","ordinal":152,"legacyIndex":125,"stars":1,"bonus":{"id":"sky2-21","num":21,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q127',126,'{"questId":"base-q127","ordinal":153,"legacyIndex":126,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q128',127,'{"questId":"base-q128","ordinal":154,"legacyIndex":127,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q129',128,'{"questId":"base-q129","ordinal":155,"legacyIndex":128,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q130',129,'{"questId":"base-q130","ordinal":156,"legacyIndex":129,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q131',130,'{"questId":"base-q131","ordinal":157,"legacyIndex":130,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q132',131,'{"questId":"base-q132","ordinal":158,"legacyIndex":131,"stars":3,"bonus":{"id":"sky2-22","num":22,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":105,"copy":"Accomplis cette quête en moins de 105 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-16-q09',null,'{"questId":"planned-real-16-q09","ordinal":159,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-16-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-16-q10',null,'{"questId":"planned-real-16-q10","ordinal":160,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-16-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q133',132,'{"questId":"base-q133","ordinal":161,"legacyIndex":132,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q134',133,'{"questId":"base-q134","ordinal":162,"legacyIndex":133,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q135',134,'{"questId":"base-q135","ordinal":163,"legacyIndex":134,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q136',135,'{"questId":"base-q136","ordinal":164,"legacyIndex":135,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q137',136,'{"questId":"base-q137","ordinal":165,"legacyIndex":136,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q138',137,'{"questId":"base-q138","ordinal":166,"legacyIndex":137,"stars":1,"bonus":{"id":"sky2-23","num":23,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q139',138,'{"questId":"base-q139","ordinal":167,"legacyIndex":138,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q140',139,'{"questId":"base-q140","ordinal":168,"legacyIndex":139,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-17-q09',null,'{"questId":"planned-real-17-q09","ordinal":169,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-17-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-17-q10',null,'{"questId":"planned-real-17-q10","ordinal":170,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-17-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q141',140,'{"questId":"base-q141","ordinal":171,"legacyIndex":140,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q142',141,'{"questId":"base-q142","ordinal":172,"legacyIndex":141,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q143',142,'{"questId":"base-q143","ordinal":173,"legacyIndex":142,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q144',143,'{"questId":"base-q144","ordinal":174,"legacyIndex":143,"stars":1,"bonus":{"id":"sky2-24","num":24,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q145',144,'{"questId":"base-q145","ordinal":175,"legacyIndex":144,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q146',145,'{"questId":"base-q146","ordinal":176,"legacyIndex":145,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q147',146,'{"questId":"base-q147","ordinal":177,"legacyIndex":146,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q148',147,'{"questId":"base-q148","ordinal":178,"legacyIndex":147,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-18-q09',null,'{"questId":"planned-real-18-q09","ordinal":179,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-18-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-18-q10',null,'{"questId":"planned-real-18-q10","ordinal":180,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-18-q10","num":30,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-18-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q149',148,'{"questId":"base-q149","ordinal":181,"legacyIndex":148,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q150',149,'{"questId":"base-q150","ordinal":182,"legacyIndex":149,"stars":2,"bonus":{"id":"sky2-25","num":25,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":115,"copy":"Accomplis cette quête en moins de 115 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q151',150,'{"questId":"base-q151","ordinal":183,"legacyIndex":150,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q152',151,'{"questId":"base-q152","ordinal":184,"legacyIndex":151,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q153',152,'{"questId":"base-q153","ordinal":185,"legacyIndex":152,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q154',153,'{"questId":"base-q154","ordinal":186,"legacyIndex":153,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q155',154,'{"questId":"base-q155","ordinal":187,"legacyIndex":154,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q156',155,'{"questId":"base-q156","ordinal":188,"legacyIndex":155,"stars":3,"bonus":{"id":"sky2-26","num":26,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-19-q09',null,'{"questId":"planned-real-19-q09","ordinal":189,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-19-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-19-q10',null,'{"questId":"planned-real-19-q10","ordinal":190,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-19-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q157',156,'{"questId":"base-q157","ordinal":191,"legacyIndex":156,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q158',157,'{"questId":"base-q158","ordinal":192,"legacyIndex":157,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q159',158,'{"questId":"base-q159","ordinal":193,"legacyIndex":158,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q160',159,'{"questId":"base-q160","ordinal":194,"legacyIndex":159,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q161',160,'{"questId":"base-q161","ordinal":195,"legacyIndex":160,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q162',161,'{"questId":"base-q162","ordinal":196,"legacyIndex":161,"stars":1,"bonus":{"id":"sky2-27","num":27,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q163',162,'{"questId":"base-q163","ordinal":197,"legacyIndex":162,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q164',163,'{"questId":"base-q164","ordinal":198,"legacyIndex":163,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-20-q09',null,'{"questId":"planned-real-20-q09","ordinal":199,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-20-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-13-q10',null,'{"questId":"planned-real-13-q10","ordinal":200,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-13-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q165',164,'{"questId":"base-q165","ordinal":201,"legacyIndex":164,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q166',165,'{"questId":"base-q166","ordinal":202,"legacyIndex":165,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q167',166,'{"questId":"base-q167","ordinal":203,"legacyIndex":166,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q168',167,'{"questId":"base-q168","ordinal":204,"legacyIndex":167,"stars":2,"bonus":{"id":"sky2-28","num":28,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":115,"copy":"Accomplis cette quête en moins de 115 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q169',168,'{"questId":"base-q169","ordinal":205,"legacyIndex":168,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q170',169,'{"questId":"base-q170","ordinal":206,"legacyIndex":169,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q171',170,'{"questId":"base-q171","ordinal":207,"legacyIndex":170,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q172',171,'{"questId":"base-q172","ordinal":208,"legacyIndex":171,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-21-q09',null,'{"questId":"planned-real-21-q09","ordinal":209,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-21-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-21-q10',null,'{"questId":"planned-real-21-q10","ordinal":210,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-21-q10","num":35,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-21-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q173',172,'{"questId":"base-q173","ordinal":211,"legacyIndex":172,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q174',173,'{"questId":"base-q174","ordinal":212,"legacyIndex":173,"stars":2,"bonus":{"id":"sky2-29","num":29,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q175',174,'{"questId":"base-q175","ordinal":213,"legacyIndex":174,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q176',175,'{"questId":"base-q176","ordinal":214,"legacyIndex":175,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q177',176,'{"questId":"base-q177","ordinal":215,"legacyIndex":176,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q178',177,'{"questId":"base-q178","ordinal":216,"legacyIndex":177,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q179',178,'{"questId":"base-q179","ordinal":217,"legacyIndex":178,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q180',179,'{"questId":"base-q180","ordinal":218,"legacyIndex":179,"stars":3,"bonus":{"id":"sky2-30","num":30,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-22-q09',null,'{"questId":"planned-real-22-q09","ordinal":219,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-22-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-22-q10',null,'{"questId":"planned-real-22-q10","ordinal":220,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-22-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q181',180,'{"questId":"base-q181","ordinal":221,"legacyIndex":180,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q182',181,'{"questId":"base-q182","ordinal":222,"legacyIndex":181,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q183',182,'{"questId":"base-q183","ordinal":223,"legacyIndex":182,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q184',183,'{"questId":"base-q184","ordinal":224,"legacyIndex":183,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q185',184,'{"questId":"base-q185","ordinal":225,"legacyIndex":184,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q186',185,'{"questId":"base-q186","ordinal":226,"legacyIndex":185,"stars":1,"bonus":{"id":"sky2-31","num":31,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":125,"copy":"Accomplis cette quête en moins de 125 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q187',186,'{"questId":"base-q187","ordinal":227,"legacyIndex":186,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q188',187,'{"questId":"base-q188","ordinal":228,"legacyIndex":187,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-23-q09',null,'{"questId":"planned-real-23-q09","ordinal":229,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-23-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-23-q10',null,'{"questId":"planned-real-23-q10","ordinal":230,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-23-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('base-q189',188,'{"questId":"base-q189","ordinal":231,"legacyIndex":188,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q190',189,'{"questId":"base-q190","ordinal":232,"legacyIndex":189,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q191',190,'{"questId":"base-q191","ordinal":233,"legacyIndex":190,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q192',191,'{"questId":"base-q192","ordinal":234,"legacyIndex":191,"stars":2,"bonus":{"id":"sky2-32","num":32,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q193',192,'{"questId":"base-q193","ordinal":235,"legacyIndex":192,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q194',193,'{"questId":"base-q194","ordinal":236,"legacyIndex":193,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q195',194,'{"questId":"base-q195","ordinal":237,"legacyIndex":194,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('base-q196',195,'{"questId":"base-q196","ordinal":238,"legacyIndex":195,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('planned-real-24-q09',null,'{"questId":"planned-real-24-q09","ordinal":239,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-24-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-24-q10',null,'{"questId":"planned-real-24-q10","ordinal":240,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-24-q10","num":40,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":145,"copy":"Accomplis cette quête en moins de 145 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-24-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q01',null,'{"questId":"planned-real-adventure-03-new-01-q01","ordinal":241,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q02',null,'{"questId":"planned-real-adventure-03-new-01-q02","ordinal":242,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q03',null,'{"questId":"planned-real-adventure-03-new-01-q03","ordinal":243,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q04',null,'{"questId":"planned-real-adventure-03-new-01-q04","ordinal":244,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q05',null,'{"questId":"planned-real-adventure-03-new-01-q05","ordinal":245,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q06',null,'{"questId":"planned-real-adventure-03-new-01-q06","ordinal":246,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-01-q06","num":41,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q07',null,'{"questId":"planned-real-adventure-03-new-01-q07","ordinal":247,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q08',null,'{"questId":"planned-real-adventure-03-new-01-q08","ordinal":248,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q09',null,'{"questId":"planned-real-adventure-03-new-01-q09","ordinal":249,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-01-q10',null,'{"questId":"planned-real-adventure-03-new-01-q10","ordinal":250,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-01-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q01',null,'{"questId":"planned-real-adventure-03-new-02-q01","ordinal":251,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q02',null,'{"questId":"planned-real-adventure-03-new-02-q02","ordinal":252,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-02-q02","num":42,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q03',null,'{"questId":"planned-real-adventure-03-new-02-q03","ordinal":253,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q04',null,'{"questId":"planned-real-adventure-03-new-02-q04","ordinal":254,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q05',null,'{"questId":"planned-real-adventure-03-new-02-q05","ordinal":255,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q06',null,'{"questId":"planned-real-adventure-03-new-02-q06","ordinal":256,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q07',null,'{"questId":"planned-real-adventure-03-new-02-q07","ordinal":257,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q08',null,'{"questId":"planned-real-adventure-03-new-02-q08","ordinal":258,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-02-q08","num":43,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":155,"copy":"Accomplis cette quête en moins de 155 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q09',null,'{"questId":"planned-real-adventure-03-new-02-q09","ordinal":259,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-02-q10',null,'{"questId":"planned-real-adventure-03-new-02-q10","ordinal":260,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-02-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q01',null,'{"questId":"planned-real-adventure-03-new-03-q01","ordinal":261,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q02',null,'{"questId":"planned-real-adventure-03-new-03-q02","ordinal":262,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q03',null,'{"questId":"planned-real-adventure-03-new-03-q03","ordinal":263,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q04',null,'{"questId":"planned-real-adventure-03-new-03-q04","ordinal":264,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-03-q04","num":44,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q05',null,'{"questId":"planned-real-adventure-03-new-03-q05","ordinal":265,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q06',null,'{"questId":"planned-real-adventure-03-new-03-q06","ordinal":266,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q07',null,'{"questId":"planned-real-adventure-03-new-03-q07","ordinal":267,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q08',null,'{"questId":"planned-real-adventure-03-new-03-q08","ordinal":268,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q09',null,'{"questId":"planned-real-adventure-03-new-03-q09","ordinal":269,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-03-q10',null,'{"questId":"planned-real-adventure-03-new-03-q10","ordinal":270,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-03-q10","num":45,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-03-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q01',null,'{"questId":"planned-real-adventure-03-new-04-q01","ordinal":271,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q02',null,'{"questId":"planned-real-adventure-03-new-04-q02","ordinal":272,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q03',null,'{"questId":"planned-real-adventure-03-new-04-q03","ordinal":273,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q04',null,'{"questId":"planned-real-adventure-03-new-04-q04","ordinal":274,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q05',null,'{"questId":"planned-real-adventure-03-new-04-q05","ordinal":275,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q06',null,'{"questId":"planned-real-adventure-03-new-04-q06","ordinal":276,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-04-q06","num":46,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":165,"copy":"Accomplis cette quête en moins de 165 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q07',null,'{"questId":"planned-real-adventure-03-new-04-q07","ordinal":277,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q08',null,'{"questId":"planned-real-adventure-03-new-04-q08","ordinal":278,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q09',null,'{"questId":"planned-real-adventure-03-new-04-q09","ordinal":279,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-04-q10',null,'{"questId":"planned-real-adventure-03-new-04-q10","ordinal":280,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-04-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q01',null,'{"questId":"planned-real-adventure-03-new-05-q01","ordinal":281,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q02',null,'{"questId":"planned-real-adventure-03-new-05-q02","ordinal":282,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-05-q02","num":47,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q03',null,'{"questId":"planned-real-adventure-03-new-05-q03","ordinal":283,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q04',null,'{"questId":"planned-real-adventure-03-new-05-q04","ordinal":284,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q05',null,'{"questId":"planned-real-adventure-03-new-05-q05","ordinal":285,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q06',null,'{"questId":"planned-real-adventure-03-new-05-q06","ordinal":286,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q07',null,'{"questId":"planned-real-adventure-03-new-05-q07","ordinal":287,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q08',null,'{"questId":"planned-real-adventure-03-new-05-q08","ordinal":288,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-05-q08","num":48,"type":3,"noAuto":false,"title":"✦ Défi céleste","seconds":null,"copy":"Accomplis cette quête et gagne le bonus céleste."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q09',null,'{"questId":"planned-real-adventure-03-new-05-q09","ordinal":289,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-05-q10',null,'{"questId":"planned-real-adventure-03-new-05-q10","ordinal":290,"legacyIndex":null,"stars":3,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-05-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q01',null,'{"questId":"planned-real-adventure-03-new-06-q01","ordinal":291,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q01') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q02',null,'{"questId":"planned-real-adventure-03-new-06-q02","ordinal":292,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q02') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q03',null,'{"questId":"planned-real-adventure-03-new-06-q03","ordinal":293,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q03') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q04',null,'{"questId":"planned-real-adventure-03-new-06-q04","ordinal":294,"legacyIndex":null,"stars":1,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-06-q04","num":49,"type":1,"noAuto":true,"title":"⚡ Défi Éclair","seconds":175,"copy":"Accomplis cette quête en moins de 175 s. · Marquage auto interdite."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q04') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q05',null,'{"questId":"planned-real-adventure-03-new-06-q05","ordinal":295,"legacyIndex":null,"stars":2,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q05') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q06',null,'{"questId":"planned-real-adventure-03-new-06-q06","ordinal":296,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q06') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q07',null,'{"questId":"planned-real-adventure-03-new-06-q07","ordinal":297,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q07') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q08',null,'{"questId":"planned-real-adventure-03-new-06-q08","ordinal":298,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q08') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q09',null,'{"questId":"planned-real-adventure-03-new-06-q09","ordinal":299,"legacyIndex":null,"stars":1,"bonus":null}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q09') on conflict do nothing;
insert into lumen_commands.quest_rules values ('planned-real-adventure-03-new-06-q10',null,'{"questId":"planned-real-adventure-03-new-06-q10","ordinal":300,"legacyIndex":null,"stars":3,"bonus":{"id":"quest-bonus:planned-real-adventure-03-new-06-q10","num":50,"type":2,"noAuto":false,"title":"🧠 Défi Esprit clair","seconds":null,"copy":"Accomplis cette quête sans indice."}}'::jsonb);
insert into lumen.canonical_quest_allowlist values ('planned-real-adventure-03-new-06-q10') on conflict do nothing;
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q001',196,'{"questId":"pack-real-adventure-04-q001","ordinal":301,"legacyIndex":196,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q002',197,'{"questId":"pack-real-adventure-04-q002","ordinal":302,"legacyIndex":197,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q003',198,'{"questId":"pack-real-adventure-04-q003","ordinal":303,"legacyIndex":198,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q004',199,'{"questId":"pack-real-adventure-04-q004","ordinal":304,"legacyIndex":199,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q005',200,'{"questId":"pack-real-adventure-04-q005","ordinal":305,"legacyIndex":200,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q006',201,'{"questId":"pack-real-adventure-04-q006","ordinal":306,"legacyIndex":201,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q007',202,'{"questId":"pack-real-adventure-04-q007","ordinal":307,"legacyIndex":202,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q008',203,'{"questId":"pack-real-adventure-04-q008","ordinal":308,"legacyIndex":203,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q009',204,'{"questId":"pack-real-adventure-04-q009","ordinal":309,"legacyIndex":204,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q010',205,'{"questId":"pack-real-adventure-04-q010","ordinal":310,"legacyIndex":205,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q011',206,'{"questId":"pack-real-adventure-04-q011","ordinal":311,"legacyIndex":206,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q012',207,'{"questId":"pack-real-adventure-04-q012","ordinal":312,"legacyIndex":207,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q013',208,'{"questId":"pack-real-adventure-04-q013","ordinal":313,"legacyIndex":208,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q014',209,'{"questId":"pack-real-adventure-04-q014","ordinal":314,"legacyIndex":209,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q015',210,'{"questId":"pack-real-adventure-04-q015","ordinal":315,"legacyIndex":210,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q016',211,'{"questId":"pack-real-adventure-04-q016","ordinal":316,"legacyIndex":211,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q017',212,'{"questId":"pack-real-adventure-04-q017","ordinal":317,"legacyIndex":212,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q018',213,'{"questId":"pack-real-adventure-04-q018","ordinal":318,"legacyIndex":213,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q019',214,'{"questId":"pack-real-adventure-04-q019","ordinal":319,"legacyIndex":214,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q020',215,'{"questId":"pack-real-adventure-04-q020","ordinal":320,"legacyIndex":215,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q021',216,'{"questId":"pack-real-adventure-04-q021","ordinal":321,"legacyIndex":216,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q022',217,'{"questId":"pack-real-adventure-04-q022","ordinal":322,"legacyIndex":217,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q023',218,'{"questId":"pack-real-adventure-04-q023","ordinal":323,"legacyIndex":218,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q024',219,'{"questId":"pack-real-adventure-04-q024","ordinal":324,"legacyIndex":219,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q025',220,'{"questId":"pack-real-adventure-04-q025","ordinal":325,"legacyIndex":220,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q026',221,'{"questId":"pack-real-adventure-04-q026","ordinal":326,"legacyIndex":221,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q027',222,'{"questId":"pack-real-adventure-04-q027","ordinal":327,"legacyIndex":222,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q028',223,'{"questId":"pack-real-adventure-04-q028","ordinal":328,"legacyIndex":223,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q029',224,'{"questId":"pack-real-adventure-04-q029","ordinal":329,"legacyIndex":224,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q030',225,'{"questId":"pack-real-adventure-04-q030","ordinal":330,"legacyIndex":225,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q031',226,'{"questId":"pack-real-adventure-04-q031","ordinal":331,"legacyIndex":226,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q032',227,'{"questId":"pack-real-adventure-04-q032","ordinal":332,"legacyIndex":227,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q033',228,'{"questId":"pack-real-adventure-04-q033","ordinal":333,"legacyIndex":228,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q034',229,'{"questId":"pack-real-adventure-04-q034","ordinal":334,"legacyIndex":229,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q035',230,'{"questId":"pack-real-adventure-04-q035","ordinal":335,"legacyIndex":230,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q036',231,'{"questId":"pack-real-adventure-04-q036","ordinal":336,"legacyIndex":231,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q037',232,'{"questId":"pack-real-adventure-04-q037","ordinal":337,"legacyIndex":232,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q038',233,'{"questId":"pack-real-adventure-04-q038","ordinal":338,"legacyIndex":233,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q039',234,'{"questId":"pack-real-adventure-04-q039","ordinal":339,"legacyIndex":234,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q040',235,'{"questId":"pack-real-adventure-04-q040","ordinal":340,"legacyIndex":235,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q041',236,'{"questId":"pack-real-adventure-04-q041","ordinal":341,"legacyIndex":236,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q042',237,'{"questId":"pack-real-adventure-04-q042","ordinal":342,"legacyIndex":237,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q043',238,'{"questId":"pack-real-adventure-04-q043","ordinal":343,"legacyIndex":238,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q044',239,'{"questId":"pack-real-adventure-04-q044","ordinal":344,"legacyIndex":239,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q045',240,'{"questId":"pack-real-adventure-04-q045","ordinal":345,"legacyIndex":240,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q046',241,'{"questId":"pack-real-adventure-04-q046","ordinal":346,"legacyIndex":241,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q047',242,'{"questId":"pack-real-adventure-04-q047","ordinal":347,"legacyIndex":242,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q048',243,'{"questId":"pack-real-adventure-04-q048","ordinal":348,"legacyIndex":243,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q049',244,'{"questId":"pack-real-adventure-04-q049","ordinal":349,"legacyIndex":244,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q050',245,'{"questId":"pack-real-adventure-04-q050","ordinal":350,"legacyIndex":245,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q051',246,'{"questId":"pack-real-adventure-04-q051","ordinal":351,"legacyIndex":246,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q052',247,'{"questId":"pack-real-adventure-04-q052","ordinal":352,"legacyIndex":247,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q053',248,'{"questId":"pack-real-adventure-04-q053","ordinal":353,"legacyIndex":248,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q054',249,'{"questId":"pack-real-adventure-04-q054","ordinal":354,"legacyIndex":249,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q055',250,'{"questId":"pack-real-adventure-04-q055","ordinal":355,"legacyIndex":250,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q056',251,'{"questId":"pack-real-adventure-04-q056","ordinal":356,"legacyIndex":251,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q057',252,'{"questId":"pack-real-adventure-04-q057","ordinal":357,"legacyIndex":252,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q058',253,'{"questId":"pack-real-adventure-04-q058","ordinal":358,"legacyIndex":253,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q059',254,'{"questId":"pack-real-adventure-04-q059","ordinal":359,"legacyIndex":254,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q060',255,'{"questId":"pack-real-adventure-04-q060","ordinal":360,"legacyIndex":255,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q061',256,'{"questId":"pack-real-adventure-04-q061","ordinal":361,"legacyIndex":256,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q062',257,'{"questId":"pack-real-adventure-04-q062","ordinal":362,"legacyIndex":257,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q063',258,'{"questId":"pack-real-adventure-04-q063","ordinal":363,"legacyIndex":258,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q064',259,'{"questId":"pack-real-adventure-04-q064","ordinal":364,"legacyIndex":259,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q065',260,'{"questId":"pack-real-adventure-04-q065","ordinal":365,"legacyIndex":260,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q066',261,'{"questId":"pack-real-adventure-04-q066","ordinal":366,"legacyIndex":261,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q067',262,'{"questId":"pack-real-adventure-04-q067","ordinal":367,"legacyIndex":262,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q068',263,'{"questId":"pack-real-adventure-04-q068","ordinal":368,"legacyIndex":263,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q069',264,'{"questId":"pack-real-adventure-04-q069","ordinal":369,"legacyIndex":264,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q070',265,'{"questId":"pack-real-adventure-04-q070","ordinal":370,"legacyIndex":265,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q071',266,'{"questId":"pack-real-adventure-04-q071","ordinal":371,"legacyIndex":266,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q072',267,'{"questId":"pack-real-adventure-04-q072","ordinal":372,"legacyIndex":267,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q073',268,'{"questId":"pack-real-adventure-04-q073","ordinal":373,"legacyIndex":268,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q074',269,'{"questId":"pack-real-adventure-04-q074","ordinal":374,"legacyIndex":269,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q075',270,'{"questId":"pack-real-adventure-04-q075","ordinal":375,"legacyIndex":270,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q076',271,'{"questId":"pack-real-adventure-04-q076","ordinal":376,"legacyIndex":271,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q077',272,'{"questId":"pack-real-adventure-04-q077","ordinal":377,"legacyIndex":272,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q078',273,'{"questId":"pack-real-adventure-04-q078","ordinal":378,"legacyIndex":273,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q079',274,'{"questId":"pack-real-adventure-04-q079","ordinal":379,"legacyIndex":274,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q080',275,'{"questId":"pack-real-adventure-04-q080","ordinal":380,"legacyIndex":275,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q081',276,'{"questId":"pack-real-adventure-04-q081","ordinal":381,"legacyIndex":276,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q082',277,'{"questId":"pack-real-adventure-04-q082","ordinal":382,"legacyIndex":277,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q083',278,'{"questId":"pack-real-adventure-04-q083","ordinal":383,"legacyIndex":278,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q084',279,'{"questId":"pack-real-adventure-04-q084","ordinal":384,"legacyIndex":279,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q085',280,'{"questId":"pack-real-adventure-04-q085","ordinal":385,"legacyIndex":280,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q086',281,'{"questId":"pack-real-adventure-04-q086","ordinal":386,"legacyIndex":281,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q087',282,'{"questId":"pack-real-adventure-04-q087","ordinal":387,"legacyIndex":282,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q088',283,'{"questId":"pack-real-adventure-04-q088","ordinal":388,"legacyIndex":283,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q089',284,'{"questId":"pack-real-adventure-04-q089","ordinal":389,"legacyIndex":284,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q090',285,'{"questId":"pack-real-adventure-04-q090","ordinal":390,"legacyIndex":285,"stars":3,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q091',286,'{"questId":"pack-real-adventure-04-q091","ordinal":391,"legacyIndex":286,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q092',287,'{"questId":"pack-real-adventure-04-q092","ordinal":392,"legacyIndex":287,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q093',288,'{"questId":"pack-real-adventure-04-q093","ordinal":393,"legacyIndex":288,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q094',289,'{"questId":"pack-real-adventure-04-q094","ordinal":394,"legacyIndex":289,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q095',290,'{"questId":"pack-real-adventure-04-q095","ordinal":395,"legacyIndex":290,"stars":2,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q096',291,'{"questId":"pack-real-adventure-04-q096","ordinal":396,"legacyIndex":291,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q097',292,'{"questId":"pack-real-adventure-04-q097","ordinal":397,"legacyIndex":292,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q098',293,'{"questId":"pack-real-adventure-04-q098","ordinal":398,"legacyIndex":293,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q099',294,'{"questId":"pack-real-adventure-04-q099","ordinal":399,"legacyIndex":294,"stars":1,"bonus":null}'::jsonb);
insert into lumen_commands.quest_rules values ('pack-real-adventure-04-q100',295,'{"questId":"pack-real-adventure-04-q100","ordinal":400,"legacyIndex":295,"stars":3,"bonus":null}'::jsonb);
-- END QUEST RULES

-- Mutable replay summaries have their own server authority. Keep the immutable
-- first-completion performance (and its unknown metadata) under the old guard.
create table lumen_commands.quest_run_authority (
 user_id uuid not null references auth.users(id) on delete cascade,
 quest_id text not null references lumen_commands.quest_rules(quest_id),
 projection jsonb not null, primary key(user_id,quest_id)
);
alter table lumen_commands.quest_run_authority enable row level security;
revoke all on lumen_commands.quest_run_authority from public,anon,authenticated;
create function lumen_commands.protect_quest_runs() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; incoming jsonb;
begin
 for r in select quest_id,projection from lumen_commands.quest_run_authority where user_id=new.user_id loop
  incoming:=new.payload->'canonicalQuestState'->r.quest_id;
  if incoming->'runPerformance' is distinct from r.projection->'runPerformance'
   or incoming->'badges' is distinct from r.projection->'badges'
  then raise exception using errcode='23514',message='quest command required; preserve pending data';end if;
 end loop;
 for r in select key,value from jsonb_each(coalesce(new.payload->'canonicalQuestState','{}')) loop
  if r.value ? 'runPerformance' and not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=new.user_id and a.quest_id=r.key)
  then raise exception using errcode='23514',message='quest run authority missing';end if;
 end loop;
 return new;
end $$;
revoke all on function lumen_commands.protect_quest_runs() from public,anon,authenticated;
create trigger protect_quest_runs before insert or update of payload on lumen.profile_snapshots
 for each row execute function lumen_commands.protect_quest_runs();
do $$
declare definition text; old_check text:='(incoming-''badges'') @> (quest.value-''badges'')';
begin
 select pg_get_functiondef('lumen.protect_canonical_snapshot()'::regprocedure) into definition;
 if position(old_check in definition)=0 then raise exception 'canonical guard changed; review migration';end if;
 execute replace(definition,old_check,'(incoming-''badges''-''runPerformance'') @> (quest.value-''badges''-''runPerformance'')');
end $$;

-- One daily identity per account/day, retaining all historical puzzle IDs.
alter table lumen.daily_progress add column stable_quest_id text;
alter table lumen.daily_progress alter column puzzle_id drop not null;
alter table lumen.daily_progress drop constraint if exists daily_progress_puzzle_id_check;
alter table lumen.daily_progress add constraint daily_progress_puzzle_id_check check(puzzle_id>=1);
alter table lumen.daily_progress add constraint daily_progress_quest_identity check(puzzle_id is not null or stable_quest_id is not null);
create function lumen_commands.claim_quest_daily(p_puzzle_id integer,p_quest_id text)
returns table(server_day date,credited boolean,reward integer,streak integer)
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();day date:=(now() at time zone 'Europe/Paris')::date;
 inserted integer:=0;s integer:=0;prev date;d date;amount integer:=0;
begin
 if uid is null then raise exception using errcode='42501',message='authentication required';end if;
 if not exists(select 1 from lumen_commands.quest_rules q where
  (p_puzzle_id is not null and q.legacy_index=p_puzzle_id-1 and p_quest_id is null) or
  (p_puzzle_id is null and q.quest_id=p_quest_id))
 then raise exception using errcode='22023',message='unknown daily quest';end if;
 insert into lumen.engagement_state(user_id) values(uid) on conflict(user_id) do nothing;
 perform 1 from lumen.engagement_state where user_id=uid for update;
 insert into lumen.daily_progress(user_id,play_date,puzzle_id,stable_quest_id) values(uid,day,p_puzzle_id,p_quest_id) on conflict(user_id,play_date) do nothing;
 get diagnostics inserted=row_count;
 for d in select play_date from lumen.daily_progress where user_id=uid and play_date<=day order by play_date desc limit 120 loop
  if prev is null then if day-d>2 then exit;end if;s:=1;prev:=d;
  elsif prev-d in (1,2) then s:=s+1;prev:=d;else exit;end if;
 end loop;
 if inserted=1 then
  if s>0 and s%7=0 then amount:=2;elsif s>0 and s%7=3 then amount:=1;end if;
  if amount>0 then
   update lumen.engagement_state set shards=shards+amount,rewarded_days=rewarded_days||jsonb_build_object(day::text,amount),updated_at=now()
   where user_id=uid and not(rewarded_days ? day::text);
   if not found then amount:=0;end if;
  end if;
 end if;
 return query select day,(inserted=1),amount,s;
end $$;
revoke all on function lumen_commands.claim_quest_daily(integer,text) from public,anon,authenticated;
create or replace function lumen_commands.claim_daily_v1(p_puzzle_id integer)
returns table(server_day date,credited boolean,reward integer,streak integer)
language sql security definer set search_path='' as $$select * from lumen_commands.claim_quest_daily(p_puzzle_id,null);$$;

create function lumen_commands.commit_quest(p_operation_id text,p_expected_user_id uuid,p_quest_id text,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();p jsonb;r jsonb;request jsonb;entry jsonb;old jsonb;badges jsonb;prior jsonb;run jsonb;eligible jsonb;
 receipt lumen_commands.canonical_receipts%rowtype; first_win boolean;qualified boolean;assisted boolean;hint boolean;wrong boolean;
 seconds integer;stars integer;xp bigint;balance bigint;wins bigint;auto_shard integer:=0;passed boolean:=false;daily boolean;
 bonus jsonb;performance jsonb;outcome jsonb;revision bigint;k text;v jsonb;d date;amount integer;dates jsonb;rewards jsonb;
 ordinal integer;best numeric;attempts bigint;speed boolean;autonomy boolean;no_error boolean;mastery boolean;
begin
 if uid is null or p_expected_user_id is distinct from uid then raise exception using errcode='42501',message='command account changed';end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$' then raise exception using errcode='22023',message='invalid operation identity';end if;
 select rules into r from lumen_commands.quest_rules where quest_id=p_quest_id;
 if not found then raise exception using errcode='22023',message='unknown quest';end if;
 -- Retain historical receipts/namespaces and the proven numeric transaction.
 if r->>'legacyIndex' is not null then return lumen_commands.commit_legacy(p_operation_id,p_expected_user_id,p_quest_id,p_facts);end if;
 if p_facts is null or jsonb_typeof(p_facts)<>'object' or octet_length(p_facts::text)>2048
  or not(p_facts ?& array['seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'])
  or exists(select 1 from jsonb_object_keys(p_facts) x where x not in ('seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'))
 then raise exception using errcode='22023',message='invalid attempt facts';end if;
 foreach k in array array['assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed'] loop
  if jsonb_typeof(p_facts->k)<>'boolean' then raise exception using errcode='22023',message='invalid attempt flag';end if;
 end loop;
 if jsonb_typeof(p_facts->'seconds')<>'number' or p_facts->>'seconds' !~ '^[0-9]{1,9}$'
  or jsonb_typeof(p_facts->'qualifiedDay')<>'string' or p_facts->>'qualifiedDay' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_facts->'qualifiedAt')<>'string' then raise exception using errcode='22023',message='invalid attempt time';end if;
 perform (p_facts->>'qualifiedDay')::date;
 if not isfinite((p_facts->>'qualifiedAt')::timestamptz) then raise exception using errcode='22023',message='invalid attempt timestamp';end if;
 request:=jsonb_build_object('version',2,'operationId',p_operation_id,'questId',p_quest_id,'facts',p_facts);
 select payload into p from lumen.profile_snapshots where user_id=uid for update;
 if p is null then raise exception using errcode='22023',message='verified cloud profile required';end if;
 select * into receipt from lumen_commands.canonical_receipts where user_id=uid and operation_id=p_operation_id;
 if found then
  if receipt.request is distinct from request then raise exception using errcode='22023',message='operation evidence changed';end if;
  return jsonb_build_object('profile',p,'request',receipt.request,'outcome',receipt.outcome,'recordedAt',receipt.recorded_at);
 end if;
 foreach k in array array['canonicalQuestState','stars','challenges'] loop
  if p ? k and jsonb_typeof(p->k)<>'object' then raise exception using errcode='22023',message='quest profile requires review';end if;
  p:=p||jsonb_build_object(k,coalesce(p->k,'{}'));
 end loop;
 foreach k in array array['xp','shards','autonomousWins'] loop
  if p ? k and (jsonb_typeof(p->k)<>'number' or p->>k !~ '^[0-9]{1,15}$') then raise exception using errcode='22023',message='quest balance requires review';end if;
 end loop;
 entry:=coalesce(p->'canonicalQuestState'->p_quest_id,'{}');
 old:=coalesce(entry->'runPerformance',entry->'performance','{}');
 if jsonb_typeof(entry)<>'object' or jsonb_typeof(old)<>'object' then raise exception using errcode='22023',message='quest performance requires review';end if;
 prior:=coalesce(entry->'badges','{}');
 if jsonb_typeof(prior)<>'object' then raise exception using errcode='22023',message='quest badges require review';end if;
 first_win:=coalesce(entry->>'solved','false') not in ('true','1');seconds:=(p_facts->>'seconds')::integer;
 qualified:=(p_facts->>'qualifying')::boolean;assisted:=(p_facts->>'assistanceUsed')::boolean;hint:=(p_facts->>'hintUsed')::boolean;wrong:=(p_facts->>'mistakeCommitted')::boolean;
 ordinal:=(r->>'ordinal')::integer;
 eligible:=jsonb_build_object('speed',true,'autonomy',true,'noError',true,'mastery',true);
 speed:=seconds<60;autonomy:=not assisted;no_error:=not assisted and not wrong;mastery:=speed and autonomy and no_error;
 run:=jsonb_build_object('eligibility',eligible,'speed',speed,'autonomy',autonomy,'noError',no_error,'mastery',mastery,'targetSeconds',60,'qualifying',qualified);
 badges:=prior;
 foreach k in array array['speed','autonomy','noError','mastery'] loop badges:=badges||jsonb_build_object(k,coalesce(prior->>k,'false') in ('true','1') or qualified and (run->>k)::boolean);end loop;
 foreach k in array array['attempts','stars','bestTime'] loop
  if old ? k and old->k<>'null' and (jsonb_typeof(old->k)<>'number' or (old->>k)::numeric<0) then raise exception using errcode='22023',message='quest summary requires review';end if;
 end loop;
 stars:=case when first_win then (r->>'stars')::integer else 0 end;
 best:=least(coalesce((old->>'bestTime')::numeric,seconds),seconds);attempts:=coalesce((old->>'attempts')::bigint,0)+1;
 performance:=old||jsonb_build_object('version',3,'badges',badges,'bestTime',best,'time',best,'stars',greatest(coalesce((old->>'stars')::integer,0),stars),'attempts',attempts,
  'lastQualifiedDay',case when qualified then p_facts->'qualifiedDay' else coalesce(old->'lastQualifiedDay','null') end,
  'lastQualifiedAt',case when qualified then p_facts->'qualifiedAt' else coalesce(old->'lastQualifiedAt','null') end);
 xp:=coalesce((p->>'xp')::bigint,0);balance:=coalesce((p->>'shards')::bigint,0);wins:=coalesce((p->>'autonomousWins')::bigint,0);
 if first_win then
  if exists(select 1 from lumen.canonical_reward_events where user_id=uid and quest_id=p_quest_id) then raise exception 'canonical ledger/profile mismatch';end if;
  xp:=xp+10+case when hint then 0 else 5 end;
  insert into lumen.canonical_reward_events(user_id,quest_id,xp_credited) values(uid,p_quest_id,case when hint then 10 else 15 end);
  entry:=entry||jsonb_build_object('stars',stars,'performance',jsonb_build_object('bestTime',seconds,'seconds',seconds,'assisted',assisted));
  if autonomy then wins:=wins+1;if wins%3=0 then auto_shard:=1;balance:=balance+1;end if;end if;
 end if;
 bonus:=r->'bonus';
 if jsonb_typeof(bonus)='object' and coalesce(p->'stars'->>(bonus->>'id'),'0') not in ('1','true') then
  passed:=not(p_facts->>'challengeFailed')::boolean and case when bonus->>'seconds' is not null then seconds<=(bonus->>'seconds')::integer when bonus->>'type'='2' then not hint else true end;
  if passed then xp:=xp+25;balance:=balance+1;p:=jsonb_set(p,array['stars',bonus->>'id'],'1');p:=jsonb_set(p,array['challenges',bonus->>'id'],'1');end if;
 end if;
 entry:=entry||jsonb_build_object('solved',true,'badges',badges,'runPerformance',performance);
 p:=jsonb_set(p,array['canonicalQuestState',p_quest_id],entry);
 daily:=first_win or qualified and exists(select 1 from jsonb_each(badges) b where b.value='true' and coalesce(prior->>b.key,'false') not in ('true','1'));
 if daily then
  perform lumen_commands.claim_quest_daily(null,p_quest_id);
  dates:=coalesce(p->'daily'->'dates','{}');rewards:=coalesce(p->'daily'->'rewards','{}');
  for d in select play_date from lumen.daily_progress where user_id=uid loop dates:=dates||jsonb_build_object(d::text,1);end loop;
  for k,v in select key,value from jsonb_each((select rewarded_days from lumen.engagement_state where user_id=uid)) loop
   amount:=v::text::integer;if amount>0 and not(rewards ? ('streak:'||k)) then balance:=balance+amount;rewards:=rewards||jsonb_build_object('streak:'||k,amount);end if;
  end loop;
  p:=jsonb_set(p,'{daily}',coalesce(p->'daily','{}')||jsonb_build_object('dates',dates,'rewards',rewards));
 end if;
 p:=p||jsonb_build_object('xp',xp,'shards',balance);
 if first_win and autonomy then p:=p||jsonb_build_object('autonomousWins',wins);end if;
 -- Update authorities before the snapshot under its existing row lock.
 insert into lumen_commands.quest_run_authority values(uid,p_quest_id,jsonb_build_object('runPerformance',performance,'badges',badges))
 on conflict(user_id,quest_id) do update set projection=excluded.projection;
 insert into lumen_commands.legacy_authority(user_id,revision,projection) values(uid,1,lumen_commands.legacy_projection(p))
 on conflict(user_id) do update set revision=lumen_commands.legacy_authority.revision+1,projection=excluded.projection returning legacy_authority.revision into revision;
 p:=p||jsonb_build_object('legacyVictoryRevision',revision);
 p:=lumen_commands.adopt_wallet_projection(uid,p);
 if octet_length(p::text)>524288 then raise exception using errcode='22001',message='quest projection too large';end if;
 update lumen.profile_snapshots set payload=p,saved_at=now() where user_id=uid;
 outcome:=jsonb_build_object('firstCompletion',first_win,'questPassed',passed,'stars',stars,'priorPerformance',old,'priorBadges',prior,
  'savedPerformance',jsonb_build_object('run',run,'qualifying',qualified,'badges',badges),'autonomyShard',auto_shard,'dailyQualified',daily,'attempts',attempts);
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome) values(uid,p_operation_id,request,outcome) returning * into receipt;
 return jsonb_build_object('profile',p,'request',request,'outcome',outcome,'recordedAt',receipt.recorded_at);
end $$;
create function lumen_commands.get_quest(p_operation_id text,p_expected_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipt lumen_commands.canonical_receipts%rowtype;
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid() then raise exception using errcode='42501',message='command account changed';end if;
 select * into receipt from lumen_commands.canonical_receipts where user_id=auth.uid() and operation_id=p_operation_id;
 if not found then return null;end if;
 return jsonb_build_object('request',receipt.request,'outcome',receipt.outcome,'recordedAt',receipt.recorded_at);
end $$;
create function public.lumen_commit_quest_command(p_operation_id text,p_expected_user_id uuid,p_quest_id text,p_facts jsonb) returns jsonb
language sql security invoker set search_path='' as $$select lumen_commands.commit_quest(p_operation_id,p_expected_user_id,p_quest_id,p_facts);$$;
create function public.lumen_get_quest_command(p_operation_id text,p_expected_user_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select lumen_commands.get_quest(p_operation_id,p_expected_user_id);$$;
create function public.lumen_quest_command_version() returns integer language plpgsql stable security invoker set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='authentication required';end if;return 1;end $$;
revoke all on function lumen_commands.commit_quest(text,uuid,text,jsonb),lumen_commands.get_quest(text,uuid) from public,anon;
grant execute on function lumen_commands.commit_quest(text,uuid,text,jsonb),lumen_commands.get_quest(text,uuid) to authenticated;
revoke all on function public.lumen_commit_quest_command(text,uuid,text,jsonb),public.lumen_get_quest_command(text,uuid),public.lumen_quest_command_version() from public,anon;
grant execute on function public.lumen_commit_quest_command(text,uuid,text,jsonb),public.lumen_get_quest_command(text,uuid),public.lumen_quest_command_version() to authenticated;
-- A captured V1 badge-only replay remains recoverable after this account starts
-- using V2. Adopt only that trusted writer's badge delta, never its run summary.
create function lumen_commands.adopt_compat_quest_badges(p_uid uuid,p_profile jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r record;incoming jsonb;
begin
 for r in select quest_id,projection from lumen_commands.quest_run_authority where user_id=p_uid loop
  incoming:=p_profile->'canonicalQuestState'->r.quest_id;
  if incoming->'runPerformance' is distinct from r.projection->'runPerformance' then raise exception using errcode='23514',message='compatibility writer changed a quest run';end if;
  update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges}',incoming->'badges') where user_id=p_uid and quest_id=r.quest_id;
 end loop;
end $$;
revoke all on function lumen_commands.adopt_compat_quest_badges(uuid,jsonb) from public,anon,authenticated;
do $$
declare definition text;boundary text:='update lumen.profile_snapshots set payload=v_payload';
begin
 select pg_get_functiondef('public.lumen_commit_canonical_victory(text,jsonb,jsonb)'::regprocedure) into definition;
 if position(boundary in definition)=0 then raise exception 'V1 canonical writer changed; review migration';end if;
 execute replace(definition,boundary,'perform lumen_commands.adopt_compat_quest_badges(v_uid,v_payload); '||boundary);
end $$;
notify pgrst,'reload schema';
