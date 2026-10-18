// Emit isolated SQL from the published metadata, never from player data.
import history from '../content/catalogue/access-origins.json' with {type:'json'};
if(!history.catalogues.every(c=>Number.isSafeInteger(c.revision)&&c.revision>0))throw Error('Invalid catalogue revision');
console.log(`do $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users values(u);
 insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{}}');
 assert (select payload->'catalogueOrigin' from lumen.profile_snapshots where user_id=u)='${history.current}'::jsonb, 'Server cohort must match the published catalogue';
end $$;`);
for(const {revision} of history.catalogues)console.log(`do $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users values(u);
 insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{"0":1},"badges":{},"catalogueOrigin":${revision}}');
 assert (select payload->'catalogueOrigin' from lumen.profile_snapshots where user_id=u)='${revision}'::jsonb, 'All archived cohorts remain readable/writable';
end $$;`);
