import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {navigateAndWait} from './cdp-client.mjs';

test('reload must leave the previous ready document and wait for the next app',async()=>{
 let navigated=false,checks=0;
 const frames=[{origin:10,ready:true},{origin:10,ready:true},
  {origin:20,ready:false},{origin:20,ready:true}];
 const evaluate=async expression=>{
  const frame=navigated?frames[Math.min(checks++,frames.length-1)]:frames[0];
  return vm.runInNewContext(expression,{performance:{timeOrigin:frame.origin},
   window:{lumenDiagnostics:frame.ready?{}:undefined},document:{readyState:'complete'}});
 };
 await navigateAndWait({send:async()=>{navigated=true},evaluate},'Page.reload');
 assert.equal(checks,4,'old document readiness must not satisfy reload');
});
test('unexpected evaluation errors remain blocking',async()=>{
 const failure=Error('unexpected fixture failure');
 await assert.rejects(navigateAndWait({send:async()=>{},evaluate:async()=>{throw failure}},'Page.reload'),failure);
});
