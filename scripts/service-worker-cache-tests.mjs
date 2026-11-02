import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync as importedExistsSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const currentCache=source.match(/const CACHE="([^"]+)"/)?.[1];
assert(currentCache?.startsWith('lumen-assets-'));
function fixture(){
 const handlers={},stores=new Map(),calls=[],messages=[],lifecycle={skipWaiting:0};let network=()=>new Response('fresh',{headers:{'Cache-Control':'max-age=3600'}});
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
  if(!stores.has(key))stores.set(key,new Map());const values=stores.get(key);
  return {put:async(req,res)=>values.set(typeof req==='string'?new URL(req,'https://lumen.test').href:req.url,res),match:async req=>values.get(typeof req==='string'?new URL(req,'https://lumen.test').href:req.url)?.clone(),addAll:async()=>{}};
 }};
 const self={location:{origin:'https://lumen.test'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{lifecycle.skipWaiting++}};
 vm.runInNewContext(source,{self,caches,URL,Response,Headers,fetch:async(...args)=>{calls.push(args);return network(...args)}});
 async function fetchAsset(path,{mode='cors',method='GET'}={}){
  let response;const jobs=[],request={url:new URL(path,'https://lumen.test').href,mode,method};
  handlers.fetch({request,respondWith:value=>response=value,waitUntil:job=>jobs.push(job)});
  if(!response)return null;
  const result=await response;await Promise.all(jobs);return result;
 }
 return {handlers,stores,calls,caches,messages,lifecycle,fetchAsset,setNetwork:fn=>network=fn};
}
test('modules and content bypass both HTTP/resource caches and retain explicit offline copies',async()=>{
 const f=fixture();
 for(const path of ['/src/main.js','/src/persistence/cloud-profile.js','/src/vendor/supabase-2.118.0.js','/src/vendor/qrcode-1.0.0.js','/content/catalogue/access-origins.json']){
  const response=await f.fetchAsset(path);assert.equal(await response.text(),'fresh');
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(f.calls.at(-1)[1].cache,'no-store');
  assert(f.stores.get(currentCache).has('https://lumen.test'+path));
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
test('public navigation bypasses HTTP cache and activation only retires old Lumen asset caches',async()=>{
 const f=fixture();await f.fetchAsset('/',{mode:'navigate'});assert.equal(f.calls[0][1].cache,'no-store');assert.equal(f.stores.size,1);
 assert(f.stores.get(currentCache).has('https://lumen.test/'));
 for(const key of ['lumen-assets-v9',currentCache,'another-feature'])f.stores.set(key,new Map());
 let activation;f.handlers.activate({waitUntil:p=>activation=p});await activation;
 assert.deepEqual([...f.stores.keys()],[currentCache,'another-feature']);
});

test('a cold offline public navigation restores the shell without caching auth or private URLs',async()=>{
 const f=fixture();await f.fetchAsset('/',{mode:'navigate'});
 f.setNetwork(()=>{throw Error('offline')});
 assert.equal(await (await f.fetchAsset('/',{mode:'navigate'})).text(),'fresh');
 await assert.rejects(f.fetchAsset('/?code=sensitive',{mode:'navigate'}),/offline/);
 await assert.rejects(f.fetchAsset('/private/',{mode:'navigate'}),/offline/);
 f.setNetwork(()=>new Response('refused',{status:503}));
 assert.equal((await f.fetchAsset('/',{mode:'navigate'})).status,503,'HTTP refusals are not disguised as offline success');
 assert.equal(f.stores.get(currentCache).size,1);
});

test('installation fetches transitive quest JSON before activating, including never-opened quests',async()=>{
 const f=fixture();
 f.setNetwork((path)=>{
  const pathname=new URL(path,'https://lumen.test').pathname;
  const files={
   '/src/main.js':"import './ui/game-screen.js';",
   '/src/ui/game-screen.js':"import {puzzles} from '../campaign/quests.js';",
   '/src/campaign/quests.js':"import puzzles from '../../content/quests.json' with {type:'json'}; export {puzzles};",
   '/content/quests.json':'{"lockedQuest":{"reg":[[0]],"sol":[0]}}'
  };
  return new Response(files[pathname]??'asset',{status:200});
 });
 let installation;
 f.handlers.install({waitUntil:p=>installation=p});
 await installation;
 assert(f.stores.get(currentCache).has('https://lumen.test/content/quests.json'));
 assert(f.stores.get(currentCache).has('https://lumen.test/src/campaign/quests.js'));
 f.setNetwork(()=>{throw Error('offline')});
 assert.equal((await f.fetchAsset('/content/quests.json')).status,200);
});
test('incomplete transitive dependency rejects service worker installation',async()=>{
 const f=fixture();
 f.setNetwork(path=>{
  const pathname=new URL(path,'https://lumen.test').pathname;
  if(pathname==='/src/main.js')return new Response("import './campaign/missing.js';");
  if(pathname==='/src/campaign/missing.js')return new Response('missing',{status:404});
  return new Response('asset');
 });
 let installation;
 f.handlers.install({waitUntil:p=>installation=p});
 await assert.rejects(installation,/Offline shell unavailable/);
});
test('cyclic module imports are only fetched once during installation',async()=>{
 const f=fixture();
 f.setNetwork(path=>{
  const pathname=new URL(path,'https://lumen.test').pathname;
  if(pathname==='/src/main.js')return new Response("import './campaign/a.js';");
  if(pathname==='/src/campaign/a.js')return new Response("import './b.js';");
  if(pathname==='/src/campaign/b.js')return new Response("import './a.js';");
  return new Response('asset');
 });
 let installation;
 f.handlers.install({waitUntil:p=>installation=p});
 await installation;
 assert.equal(f.calls.filter(([path])=>new URL(path,'https://lumen.test').pathname==='/src/campaign/a.js').length,1);
});

test('real published game module graph includes catalogue data before offline activation',()=>{
 const {existsSync}=fsForOfflineGraph();
 const root=new URL('../',import.meta.url);
 const visited=new Set(),pending=['/src/main.js','/src/ui/game-screen.js'];
 const dependencies=/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g;
 while(pending.length){
  const path=pending.shift();
  if(visited.has(path))continue;
  visited.add(path);
  const file=new URL('.'+path,root);
  assert(existsSync(file),'Missing module dependency: '+path);
  if(!/\.(?:js|mjs|css)$/.test(path))continue;
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(dependencies)){
   const resolved=new URL(match[1],'https://lumen.test'+path);
   if(resolved.origin==='https://lumen.test'&&(/^\/src\//.test(resolved.pathname)||/^\/content\//.test(resolved.pathname)))pending.push(resolved.pathname);
  }
  assert(visited.size<2000,'Unexpectedly large or cyclic dependency graph');
 }
 for(const required of ['/src/campaign/catalogue.js','/content/generated/first-adventure.json','/content/generated/diverse-adventures-3-4.json','/content/catalogue/access-origins.json'])
  assert(visited.has(required),'Offline module graph omitted required catalogue asset: '+required);
});
function fsForOfflineGraph(){return {existsSync:importedExistsSync};}

test('failed install does not request activation and keeps prior cache',async()=>{
 const f=fixture();
 f.stores.set('lumen-assets-v12',new Map([['https://lumen.test/',new Response('previous')]]));
 f.setNetwork(path=>new URL(path,'https://lumen.test').pathname==='/src/main.js'
  ?new Response('missing',{status:503}):new Response('ok'));
 let install;
 f.handlers.install({waitUntil:p=>install=p});
 await assert.rejects(install,/Offline shell unavailable/);
 assert.equal(f.lifecycle.skipWaiting,0);
 assert(f.stores.has('lumen-assets-v12'));
});
test('successful install requests activation only after the complete shell is cached',async()=>{
 const f=fixture();
 f.setNetwork(()=>new Response('ok'));
 let install;
 f.handlers.install({waitUntil:p=>install=p});
 assert.equal(f.lifecycle.skipWaiting,0);
 await install;
 assert.equal(f.lifecycle.skipWaiting,1);
 assert(f.stores.get(currentCache).has('https://lumen.test/src/main.js'));
});

test('offline readiness is reported only after a complete install',async()=>{
 const f=fixture();
 f.setNetwork(()=>new Response('asset'));
 let install;
 f.handlers.install({waitUntil:p=>install=p});
 await install;
 const replies=[];
 let status;
 f.handlers.message({data:{type:'OFFLINE_CACHE_STATUS'},source:{postMessage:x=>replies.push(x)},waitUntil:p=>status=p});
 await status;
 assert.equal(replies[0].ready,true);
 assert(replies[0].assets>=11);
 assert.equal(replies[0].version,currentCache);
 const cache=f.stores.get(currentCache);
 cache.delete('https://lumen.test/__lumen_offline_ready_v13__');
 f.handlers.message({data:{type:'OFFLINE_CACHE_STATUS'},source:{postMessage:x=>replies.push(x)},waitUntil:p=>status=p});
 await status;
 assert.equal(replies[1].ready,false);
});
