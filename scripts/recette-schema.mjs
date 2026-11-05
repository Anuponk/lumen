import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const QA='lumen_recette',ROLE='lumen_recette_runner';
const identifier=value=>typeof value==='string'&&/^[a-z_][a-z_0-9]*$/.test(value);
const configTables=new Set(['legacy_rules','quest_rules','canonical_quest_allowlist']);
export function relocateRecetteSql(source){
 if(typeof source!=='string'||/\b(?:copy|dblink|pg_read_file|pg_write_file|lo_import)\b/i.test(source.replace(/^\s*--[^\n]*$/gm,'')))throw Error('Unsupported recipe definition');
 const next=source.replace(/\b(?:lumen_commands|lumen)\./gi,QA+'.').replace(/\bpublic\.(lumen_[a-z_0-9]+)/gi,QA+'.$1').replace(/\bauth\.uid\s*\(/gi,QA+'.auth_uid(');
 if(/\b(?:public|lumen|lumen_commands|storage|vault)\./i.test(next))throw Error('Production reference remains');
 const schemas=[...next.matchAll(/\b([a-z_][a-z_0-9]*)\.[a-z_][a-z_0-9]*\s*\(/gi)].map(m=>m[1]);
 if(schemas.some(schema=>![QA,'auth','pg_catalog'].includes(schema)))throw Error('External dependency');
 if(/\bauth\.(?!uid\s*\()/i.test(next))throw Error('Auth data dependency');
 return next;
}
export function buildRecetteSchema(metadata){
 if(!metadata||!/^[a-f0-9]{40}$/.test(metadata.revision)||!Array.isArray(metadata.tables)||!Array.isArray(metadata.functions)||!Array.isArray(metadata.triggers))throw Error('Missing source attestation');
 const names=new Set();
 for(const table of metadata.tables){
  if(!['lumen','lumen_commands'].includes(table.schema)||!identifier(table.name)||names.has(table.name))throw Error('Invalid or colliding table');
  names.add(table.name);
 }
 const sql=[`-- Optional shared-project QA bootstrap. Never an application migration.`,
  `-- Source revision: ${metadata.revision}. No production player rows are copied.`,
  `do $$begin
 if to_regnamespace('${QA}') is null or exists(select 1 from pg_class where relnamespace='${QA}'::regnamespace) or exists(select 1 from pg_proc where pronamespace='${QA}'::regnamespace) then raise exception 'Expected empty private QA schema';end if;
 if exists(select 1 from pg_roles where rolname='${ROLE}') then raise exception 'QA runner already exists';end if;
end $$;`,
  `create role ${ROLE} nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`,
  // Only the existing administrator inherits QA ownership. The QA role itself
  // remains NOINHERIT and receives no membership in an application role.
  `grant ${ROLE} to postgres with inherit true, set true;`,
  `grant usage,create on schema ${QA} to ${ROLE};`,
  `create function ${QA}.auth_uid() returns uuid language sql stable set search_path='' as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`,
  `alter function ${QA}.auth_uid() owner to ${ROLE};`,
  `revoke all on function ${QA}.auth_uid() from public,anon,authenticated,service_role;`,
  `set local check_function_bodies=off;`];
 for(const table of metadata.tables){
  sql.push(`create table ${QA}.${table.name} (like ${table.schema}.${table.name} including defaults including constraints including indexes including storage);`,
   `alter table ${QA}.${table.name} owner to ${ROLE};`,
   `alter table ${QA}.${table.name} enable row level security;`,
   `revoke all on ${QA}.${table.name} from public,anon,authenticated,service_role;`);
 }
 sql.push(`create table ${QA}.actors(id uuid primary key);`,`alter table ${QA}.actors owner to ${ROLE};`,`alter table ${QA}.actors enable row level security;`,`revoke all on ${QA}.actors from public,anon,authenticated,service_role;`);
 for(const fn of metadata.functions){
  if(!identifier(fn.name)||!['lumen','lumen_commands','public'].includes(fn.schema)||typeof fn.identity!=='string'||/[;'$]/.test(fn.identity))throw Error('Invalid function identity');
  const def=relocateRecetteSql(fn.definition);
  if(!new RegExp('^CREATE OR REPLACE FUNCTION '+QA+'\\.'+fn.name+'\\(','i').test(def))throw Error('Function target mismatch');
  sql.push(def.trimEnd()+';',`alter function ${QA}.${fn.name}(${fn.identity}) owner to ${ROLE};`,`revoke all on function ${QA}.${fn.name}(${fn.identity}) from public,anon,authenticated,service_role;`);
 }
 for(const trigger of metadata.triggers){
  if(!names.has(trigger.table)||!identifier(trigger.name)||!metadata.functions.some(fn=>fn.name===trigger.function&&fn.schema===trigger.functionSchema))throw Error('Invalid trigger');
  sql.push(relocateRecetteSql(trigger.definition)+';');
 }
 for(const table of metadata.tables.filter(t=>configTables.has(t.name)))sql.push(`insert into ${QA}.${table.name} select * from ${table.schema}.${table.name};`);
 sql.push(`create table ${QA}.environment(singleton boolean primary key default true check(singleton),source_revision text not null,installed_at timestamptz not null default now(),auth_mode text not null default 'shared-auth-sql-claims-only');`,
 `insert into ${QA}.environment(singleton,source_revision) values(true,'${metadata.revision}');`,
 `alter table ${QA}.environment owner to ${ROLE};`,`alter table ${QA}.environment enable row level security;`,`revoke all on ${QA}.environment from public,anon,authenticated,service_role;`,
 `revoke all on schema ${QA} from public,anon,authenticated,service_role;`);
 return sql.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: node scripts/recette-schema.mjs structure.json optional-bootstrap.sql');
 const sql=buildRecetteSchema(JSON.parse(await fs.readFile(input,'utf8')));
 await fs.writeFile(output,sql,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({schema:QA,sqlBytes:Buffer.byteLength(sql),copiesPlayerRows:false}));
}
