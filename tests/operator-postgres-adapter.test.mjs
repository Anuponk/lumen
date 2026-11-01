import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOperatorTransaction} from '../src/privacy/operator-postgres-adapter.mjs';
test('owner-only transaction commits after reviewed erasure',async()=>{
 const sql=[];
 const client={query:async(q,args)=>{sql.push([q,args]);if(q.startsWith('select current_user'))return {rows:[{role:'postgres',auth_uid:null}]};return {rows:[{report:{ok:true}}]};},end:async()=>{}};
 const run=await createOperatorTransaction({connectionString:'postgresql://private-host/db',connect:async()=>client});
 const result=await run(async tx=>{await tx.review('00000000-0000-4000-8000-000000000001',[]);return tx.erase('00000000-0000-4000-8000-000000000001',[],'ERASE LUMEN 00000000-0000-4000-8000-000000000001')});
 assert.deepEqual(result,{ok:true});assert.equal(sql.at(-1)[0],'COMMIT');
});
test('non-operator database connection rolls back',async()=>{
 const sql=[];const client={query:async q=>{sql.push(q);return {rows:[{role:'service_role',auth_uid:null}]};},end:async()=>{}};
 const run=await createOperatorTransaction({connectionString:'postgresql://private-host/db',connect:async()=>client});
 await assert.rejects(run(async()=>{}),/Operator-only/);assert.equal(sql.at(-1),'ROLLBACK');
});
test('SQL failure rolls back and never commits',async()=>{
 const sql=[];const client={query:async q=>{sql.push(q);if(q.startsWith('select current_user'))return {rows:[{role:'postgres',auth_uid:null}]};if(q.includes('erase_account'))throw Error('db failure');return {rows:[{report:{}}]};},end:async()=>{}};
 const run=await createOperatorTransaction({connectionString:'postgresql://private-host/db',connect:async()=>client});
 await assert.rejects(run(tx=>tx.erase('00000000-0000-4000-8000-000000000001',[],'ERASE LUMEN 00000000-0000-4000-8000-000000000001')),/db failure/);
 assert.equal(sql.at(-1),'ROLLBACK');assert.equal(sql.includes('COMMIT'),false);
});
