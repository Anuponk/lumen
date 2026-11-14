// QA adapter only. Never install these objects as the production erasure API.
// The complete candidate engine is copied with a fixed namespace substitution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8').replace(/\r\n?/g,'\n');
const engine=read('supabase/migrations/20261022160212_lumen_account_erasure.sql');
const wrapper=read('supabase/migrations/20261101180000_lumen_self_erasure.sql');
const fixture=read('scripts/privacy-full-erasure.test.py');
const names={lumen_privacy:'lumen_erasure_qa',lumen:'lumen_erasure_qa_data',lumen_commands:'lumen_erasure_qa_commands',public:'lumen_erasure_qa_public',auth:'lumen_erasure_qa_auth',soldezen:'lumen_erasure_qa_other_app'};
function isolate(sql){
 const result=sql.replace(/\b(lumen_privacy|lumen_commands|lumen|auth|soldezen)\b/g,name=>names[name])
  .replace(/\bpublic\./g,names.public+'.').replace(/'public'/g,"'"+names.public+"'");
 assert.doesNotMatch(result,/\b(?:lumen_privacy|lumen_commands|lumen|auth|soldezen|public)\./,'Unmapped production namespace');
 return result;
}
const policy=engine.slice(engine.indexOf('create function lumen_privacy.policy()'),engine.indexOf('create function lumen_privacy.scope_predicate('));
const createTables=fixture.match(/bootstrap \+= "create schema lumen_privacy;\\n" \+ policy \+ """([\s\S]*?)"""/)[1].replace('drop schema lumen_privacy cascade;','').replace('create table %I.%I','create table if not exists %I.%I');
let bootstrap=fixture.match(/bootstrap = """([\s\S]*?)"""/)[1]
 .replace(/create role (?:anon|authenticated|service_role) nologin;\s*/g,'')
 .replace(/insert into auth\.users[\s\S]*?;/,'').replace(/insert into soldezen\.accounts[\s\S]*?;/,'');
const extra=`
create schema lumen_privacy;
create schema ${names.public};
create function auth.role() returns text language sql stable as $role$ select nullif(current_setting('request.jwt.claim.role',true),'') $role$;
create table lumen_commands.support_control(id uuid primary key,user_id uuid);
create table lumen_commands.support_cases(id uuid primary key,user_id uuid);
create table lumen_commands.support_captures(id uuid primary key,case_id uuid references lumen_commands.support_cases(id) on delete cascade);
create table lumen_commands.support_contents(id uuid primary key,capture_id uuid references lumen_commands.support_captures(id) on delete cascade);
create table lumen_commands.support_access(id uuid primary key,actor text,privacy_owner_id uuid,case_id uuid);
`;
// Existing authorized QA schema must still be empty. No replacement of unknown objects.
const fence=`do $fence$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(array[${Object.values(names).map(n=>"'"+n+"'").join(',')}]))
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any(array[${Object.values(names).map(n=>"'"+n+"'").join(',')}])) then
  raise exception 'QA namespace is not empty; inspect before changing it';end if;
end $fence$;\n`;
bootstrap=bootstrap.replace('begin;',fence).replace('create schema lumen;','create schema lumen;').replace('create schema lumen_commands;','create schema lumen_commands;');
// The pre-existing empty namespace is reused, never dropped.
const setup=isolate((bootstrap+extra+policy+createTables+engine.replace('create schema lumen_privacy;','').replace('create function lumen_privacy.policy()','create or replace function lumen_privacy.policy()')+wrapper)
 .replace('create schema lumen_privacy;','create schema if not exists lumen_privacy;'))+
 Object.values(names).map(n=>`revoke all on schema ${n} from public,anon,authenticated,service_role;\nalter default privileges in schema ${n} revoke all on tables from public,anon,authenticated,service_role;`).join('\n')+`\ngrant usage on schema ${names.public} to service_role;\n`;
// Fixture transaction changes only synthetic QA rows and always rolls back.
const tests=fixture.match(/tests = """([\s\S]*?)"""/)[1];
const unknown=tests.slice(0,tests.indexOf('insert into lumen.profiles'));
const schemaCheck=isolate(unknown)+`\ngrant usage on schema ${names.public} to service_role;\n`;
const seed=`begin;
set local request.jwt.claim.sub='';set local request.jwt.claim.role='service_role';
insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into soldezen.accounts values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',42),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',17);
`;
const checks=isolate(seed+tests.slice(tests.indexOf('insert into lumen.profiles')).replace('rollback;',`
set local role service_role;
do $wrapper$ declare r jsonb;begin
 r:=public.lumen_self_erase('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','SUPPRIMER');
 assert r->>'status'='erased' and r->>'barrier'='active' and r->'authDeleted'='false','Privileged wrapper acknowledgement';
end $wrapper$;
reset role;
do $sentinels$ begin
 assert (select count(*) from auth.users)=2,'Synthetic Auth preserved';
 assert (select sum(balance) from soldezen.accounts)=59,'Synthetic other application preserved';
end $sentinels$;
rollback;`));
const digest=createHash('sha256').update(engine+'\n'+wrapper).digest('hex');
if(process.argv.includes('--setup'))process.stdout.write('-- Candidate source SHA256: '+digest+'\n'+setup);
else if(process.argv.includes('--fixture'))process.stdout.write(checks);
else if(process.argv.includes('--schema-check'))process.stdout.write(schemaCheck);
else console.log(JSON.stringify({sourceSha256:digest,namespaces:names,setupBytes:setup.length,fixtureBytes:checks.length,scope:'QA namespace adaptation; no real Auth end-to-end claim'}));
