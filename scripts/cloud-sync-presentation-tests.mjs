import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSyncPresentation} from '../src/persistence/sync-presentation.js';
test('transient durable failure and recovery never interrupt celebration',()=>{
 const changes=[],s=createSyncPresentation({onChange:v=>changes.push(v)});
 s.celebration(true);s.pending({durable:true});s.failed({durable:true});s.acknowledged();s.celebration(false);
 assert.equal(changes.some(v=>v.alert),false);assert.equal(s.snapshot().status,'confirmed');
});
test('persistent protected failure is actionable after celebration, once per incident',()=>{
 const s=createSyncPresentation();s.celebration(true);
 for(let i=0;i<3;i++)assert.equal(s.failed({durable:true}).alert,false);
 assert.equal(s.snapshot().status,'persistent');assert.equal(s.celebration(false).alert,true);
 assert.equal(s.announced().alert,false);assert.equal(s.failed({durable:true}).alert,false);
 s.acknowledged();assert.equal(s.failed({durable:true,retryable:false}).alert,true);
});
test('unconfirmed local preservation is critical immediately, including during celebration',()=>{
 const s=createSyncPresentation();s.celebration(true);
 assert.equal(s.failed({durable:false}).alert,true);assert.equal(s.snapshot().status,'critical');
});
