import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecetteSchema,relocateRecetteSql} from './recette-schema.mjs';
const revision='a'.repeat(40);
const fn={schema:'public',name:'lumen_restore_profile',identity:'',definition:"CREATE OR REPLACE FUNCTION public.lumen_restore_profile() RETURNS jsonb LANGUAGE sql SET search_path='' AS $$select payload from lumen.profile_snapshots where user_id=auth.uid()$$"};
const metadata={revision,tables:[{schema:'lumen',name:'profile_snapshots'},{schema:'lumen_commands',name:'quest_rules'}],functions:[fn],triggers:[]};
test('QA source retains command bodies while binding every app dependency to the private namespace',()=>{
 const sql=buildRecetteSchema(metadata);
 assert.match(sql,/lumen_recette\.profile_snapshots where user_id=lumen_recette.auth_uid\(\)/);
 assert.doesNotMatch(sql,/grant usage on schema auth/);
 assert.match(sql,/owner to lumen_recette_runner/);
 assert.match(sql,/nologin noinherit nosuperuser/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/insert into lumen_recette.quest_rules select \* from lumen_commands.quest_rules/);
 assert.doesNotMatch(sql,/insert into lumen_recette.profile_snapshots select/);
 assert.doesNotMatch(sql,/grant .* to (?:anon|authenticated|service_role)/i);
 assert.match(sql,/Expected empty private QA schema/);
});
test('recipe compiler rejects shared Auth tables, external dependencies and privileged escape paths',()=>{
 for(const sql of ['select * from auth.users','select public.other_rpc()','select vault.decrypt()','select extensions.dblink()','copy foo from program x'])assert.throws(()=>relocateRecetteSql(sql));
 assert.throws(()=>buildRecetteSchema({...metadata,tables:[...metadata.tables,{schema:'lumen_commands',name:'profile_snapshots'}]}));
 assert.throws(()=>buildRecetteSchema({...metadata,revision:'unattested'}));
 assert.throws(()=>buildRecetteSchema({...metadata,functions:[{...fn,identity:"x text);drop schema lumen;--"}]}));
});
