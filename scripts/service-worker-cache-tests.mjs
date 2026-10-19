import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function fixture(){
 const handlers={},stores=new Map(),calls=[];let network=()=>new Response('fresh',{headers:{'Cache-Control':'max-age=3600'}});
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
  if(!stores.has(key))stores.set(key,new Map());const values=stores.get(key);
  return {put:async(req,res)=>values.set(req.url,res),match:async req=>values.get(req.url)?.clone(),addAll:async()=>{}};
 }};
 const self={location:{origin:'https://lumen.test'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{}};
 vm.runInNewContext(source,{self,caches,URL,Response,Headers,fetch:async(...args)=>{calls.push(args);return network(...args)}});
 async function fetchAsset(path,{mode='cors',method='GET'}={}){
  let response;const jobs=[],request={url:new URL(path,'https://lumen.test').href,mode,method};
  handlers.fetch({request,respondWith:value=>response=value,waitUntil:job=>jobs.push(job)});
  if(!response)return null;
  const result=await response;await Promise.all(jobs);return result;
 }
 return {handlers,stores,calls,caches,fetchAsset,setNetwork:fn=>network=fn};
}
test('modules and content bypass both HTTP/resource caches and retain explicit offline copies',async()=>{
 const f=fixture();
 for(const path of ['/src/main.js','/src/persistence/cloud-profile.js','/content/catalogue/access-origins.json']){
  const response=await f.fetchAsset(path);assert.equal(await response.text(),'fresh');
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(f.calls.at(-1)[1].cache,'no-store');
  assert(f.stores.get('lumen-assets-v10').has('https://lumen.test'+path));
 }
 f.setNetwork(()=>{throw Error('offline')});
 assert.equal(await (await f.fetchAsset('/src/main.js')).text(),'fresh');
 await assert.rejects(f.fetchAsset('/src/not-cached.js'),/offline/);
});
test('HTTP errors cannot overwrite a good asset or masquerade as successful content',async()=>{
 const f=fixture();await f.fetchAsset('/src/main.js');
 for(const status of [403,404,429,500]){
  f.setNetwork(()=>new Response('refused',{status}));assert.equal((await f.fetchAsset('/src/main.js')).status,status);
 }
 f.setNetwork(()=>{throw Error('offline')});assert.equal(await (await f.fetchAsset('/src/main.js')).text(),'fresh');
});
test('provider APIs, private routes and non-GET requests are not intercepted or cached',async()=>{
 const f=fixture();
 for(const path of ['https://project.supabase.co/rest/v1/profile','/api/profile','/lumen-release/','/build-info.json'])assert.equal(await f.fetchAsset(path),null);
 assert.equal(await f.fetchAsset('/src/main.js',{method:'POST'}),null);assert.equal(f.calls.length,0);assert.equal(f.stores.size,0);
});
test('an unavailable asset cache cannot hide a successful network response',async()=>{
 const f=fixture();f.caches.open=async()=>{throw Error('quota')};
 assert.equal(await (await f.fetchAsset('/src/main.js')).text(),'fresh');
});
test('navigation stays network-only and activation only retires old Lumen asset caches',async()=>{
 const f=fixture();await f.fetchAsset('/',{mode:'navigate'});assert.equal(f.calls[0][1].cache,'no-store');assert.equal(f.stores.size,0);
 for(const key of ['lumen-assets-v9','lumen-assets-v10','another-feature'])f.stores.set(key,new Map());
 let activation;f.handlers.activate({waitUntil:p=>activation=p});await activation;
 assert.deepEqual([...f.stores.keys()],['lumen-assets-v10','another-feature']);
});
