import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Readable} from 'node:stream';
import {createNodeDeletionRoute} from '../src/privacy/node-deletion-route.mjs';
async function invoke({method='POST',headers={'content-type':'application/json'},body='{}',handle=async()=>({status:200,headers:{'content-type':'application/json'},body:'{"status":"completed"}'})}={}) {
 const req=Readable.from([body]);req.method=method;req.headers=headers;
 const result={};const res={headersSent:false,writeHead(status,h){result.status=status;result.headers=h;this.headersSent=true;},end(payload){result.body=payload;}};
 await createNodeDeletionRoute({handle})(req,res);
 return result;
}
test('private route accepts bounded JSON and returns no-store',async()=>{
 const r=await invoke();assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'no-store');
});
test('private route rejects oversized bodies and unsupported methods',async()=>{
 assert.equal((await invoke({body:'x'.repeat(1100)})).status,413);
 assert.equal((await invoke({method:'GET'})).status,405);
 assert.equal((await invoke({headers:{'content-type':'text/plain'}})).status,415);
});
test('private route rejects cross-origin browser requests',async()=>{
 assert.equal((await invoke({headers:{'content-type':'application/json',origin:'https://evil.example'}})).status,403);
});
test('private route does not leak handler exceptions',async()=>{
 const r=await invoke({handle:async()=>{throw Error('private secret')}});
 assert.equal(r.status,503);assert.ok(!r.body.includes('private secret'));
});
