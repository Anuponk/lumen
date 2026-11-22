import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOutboxHealthReporter,outboxHealthVersion,outboxStorageFields} from '../src/persistence/outbox-health.js';
test('outbox health survives quota, deduplicates, and never transmits operation facts',async()=>{
 const calls=[],client={};
 const reporter=createOutboxHealthReporter({storage:{getItem(){throw Error('quota')}},newId:()=> '00000000-0000-0000-0000-000000000001',
  now:()=> '2026-10-22T04:00:00Z',send:async(_client,payload)=>calls.push(payload)});
 const input={userId:'synthetic',client,platform:'android-pwa',pending:[{createdAt:'2026-10-22T03:00:00Z',reward:{private:'secret'},operationId:'must-not-leak',email:'private@example.invalid'}]};
 await reporter.report(input);await reporter.report(input);assert.equal(calls.length,1);
 assert.equal(calls[0].p_pending,1);assert.equal(calls[0].p_oldest_at,'2026-10-22T03:00:00.000Z');
 assert(!/secret|must-not-leak|email|reward/.test(JSON.stringify(calls)));
 await reporter.report({...input,state:'confirmed',pending:[]});assert.equal(calls.length,2);assert.equal(calls[1].p_pending,0);
});
// #962: production stored every observation as "unknown" because the visible label was
// sent verbatim. SERVER is the exact rule of lumen_commands.record_outbox_health.
test('outbox health sends the build in the format the server accepts',async()=>{
 const SERVER=/^(unknown|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}([ .-]+[0-9a-f]{7,40})?)$/;
 for(const [label,expected] of [['Version 1.11.1+763 · fac6059','1.11.1+763 fac6059'],['1.11.1+763 · fac6059','1.11.1+763 fac6059'],
  ['1.11.1+763','1.11.1+763'],['Version v1.11.1-dev-learning-sequence','unknown'],['Version en cours de chargement','unknown'],[undefined,'unknown'],
  ['Version 1.11.1+763 · fac6059<script>','1.11.1+763 fac6059']]){
  assert.equal(outboxHealthVersion(label),expected,String(label));assert.match(outboxHealthVersion(label),SERVER);
 }
 const calls=[];const reporter=createOutboxHealthReporter({storage:{getItem:()=>null,setItem(){}},newId:()=> '00000000-0000-0000-0000-000000000002',
  now:()=> '2026-11-22T15:00:00Z',send:async(_client,payload)=>calls.push(payload)});
 await reporter.report({userId:'synthetic',client:{},version:'Version 1.11.1+763 · fac6059',state:'confirmed'});
 assert.equal(calls[0].p_version,'1.11.1+763 fac6059');
});

// #962: bounded storage health; a full device storage was invisible on the server.
test('outbox health sends only storage buckets and a storage error category',async()=>{
 assert.deepEqual(outboxStorageFields({bytes:8724750,error:'quota'}),{p_storage_kb:8704,p_storage_ratio:85,p_storage_error:'quota'});
 assert.deepEqual(outboxStorageFields({bytes:1,error:'network'}),{p_storage_kb:256,p_storage_ratio:0,p_storage_error:null});
 assert.deepEqual(outboxStorageFields({bytes:0}),{p_storage_kb:0,p_storage_ratio:0,p_storage_error:null});
 assert.deepEqual(outboxStorageFields({bytes:'x',error:'QuotaExceededError: secret'}),{p_storage_kb:null,p_storage_ratio:null,p_storage_error:null});
 assert.equal(outboxStorageFields(null),null);
 assert.equal(outboxStorageFields({bytes:1e12}).p_storage_ratio,100);assert.equal(outboxStorageFields({bytes:1e12}).p_storage_kb,1048576);
 const calls=[];const reporter=createOutboxHealthReporter({storage:{getItem:()=>null,setItem(){}},newId:()=> '00000000-0000-0000-0000-000000000003',
  now:()=> '2026-11-22T20:00:00Z',send:async(_client,payload)=>calls.push(payload)});
 await reporter.report({userId:'synthetic',client:{},state:'pending',pending:[{createdAt:'2026-10-23T11:59:00Z'}],device:{bytes:8724750,error:'quota'}});
 assert.equal(calls[0].p_storage_kb,8704);assert.equal(calls[0].p_storage_error,'quota');
 await reporter.report({userId:'synthetic',client:{},state:'pending',pending:[{createdAt:'2026-10-23T11:59:00Z'}],device:{bytes:8724751,error:'quota'}});
 assert.equal(calls.length,1,'a change inside the same bucket sends nothing');
 await reporter.report({userId:'synthetic',client:{},state:'pending',pending:[{createdAt:'2026-10-23T11:59:00Z'}]});
 assert.equal(Object.hasOwn(calls[1],'p_storage_kb'),false,'no storage fields when unknown (older server stays compatible)');
 assert(!JSON.stringify(calls).match(/secret|lumen[A-Z]/));
});
