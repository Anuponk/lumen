import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as cdp from './cdp-client.mjs';
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

// Exercise the actual suite teardown, including preservation of an earlier
// failed assertion. The quality runner owns final process cleanup separately.
for(const suite of ['browser-tests.mjs','learning-browser-tests.mjs','late-game-browser-tests.mjs','ux-cleanup-tests.mjs','sky-navigation-browser-tests.mjs']){
 const source=fs.readFileSync(new URL(suite,import.meta.url),'utf8');
 const marker='}finally{',start=source.lastIndexOf(marker)+marker.length;
 assert(start>=marker.length,suite+' must have its outer teardown');
 const teardown=source.slice(start,source.lastIndexOf('}'));
 const execute=(failure,original)=>vm.runInNewContext('(async()=>{try{if(original)throw original;}finally{'+teardown+'}})()',{
  send:async method=>{assert.equal(method,'Browser.close');if(failure)throw failure;},
  closeBrowser:cdp.closeBrowser,original,console:{warn(){}}
 });
 test(suite+' tolerates only missing shutdown acknowledgement and keeps original assertions',async()=>{
  await execute(null);
  await execute(Error('CDP timeout after 15s: Browser.close'));
  const original=Error('business assertion failed');
  await assert.rejects(execute(Error('CDP timeout after 15s: Browser.close'),original),error=>error===original);
  for(const failure of [Error('CDP timeout after 15s: Runtime.evaluate'),Error('unrelated transport error')])
   await assert.rejects(execute(failure),error=>error===failure);
 });
}
