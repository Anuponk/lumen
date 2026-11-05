const CACHE="lumen-assets-v15";
const OFFLINE_READY_MARKER="/__lumen_offline_ready_v15__";
const SHELL=["/manifest.webmanifest","/icon.svg","/icon-maskable.svg","/","/src/main.js","/src/ui/game-screen.js","/src/ui/styles.css","/src/ui/first-welcome.css","/src/ui/build-version.js","/src/vendor/supabase-2.118.0.js","/src/vendor/qrcode-1.0.0.js"];
// Crawl the static ES-module graph before activation, including JSON imports.
// Only same-origin public application resources are eligible for this cache.
function staticDependencies(source,base){
 const found=new Set();
 const patterns=[/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g,/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,/@import\s+(?:url\()?["']([^"']+)["']/g];
 for(const pattern of patterns){for(const match of source.matchAll(pattern)){
  // Native public modules use URL specifiers. Bare package names embedded in
  // vendored bundles are not paths relative to that bundle (e.g. optional SDK tracing).
  if(!match[1].startsWith('.')&&!match[1].startsWith('/'))continue;
  try{const url=new URL(match[1],base);if(url.origin===self.location.origin&&(/^\/src\//.test(url.pathname)||/^\/content\//.test(url.pathname))&&!url.search)found.add(url.pathname)}catch{}
 }}
 return [...found];
}
async function precacheCompleteShell(cache){
 const pending=[...SHELL],visited=new Set();
 while(pending.length){
  const path=pending.shift();
  if(visited.has(path))continue;
  visited.add(path);
  const response=await fetch(path,{cache:"no-store"});
  if(!response.ok||response.redirected)throw new Error("Offline shell unavailable: "+path+" ("+response.status+")");
  if(visited.size>2000)throw new Error("Offline asset graph exceeds safety limit");
  if(/\.(?:js|mjs|css)$/.test(path)){
   const source=await response.clone().text();
   pending.push(...staticDependencies(source,new URL(path,self.location.origin)));
  }
  await cache.put(path,response);
 }
 return [...visited];
}
async function completeCachedShell(cache){
 const marker=await cache.match(OFFLINE_READY_MARKER);if(!marker)return false;
 try{
  const assets=await marker.json();
  if(!Array.isArray(assets)||!assets.length)return false;
  for(const path of assets)if(typeof path!=='string'||!path.startsWith('/')||!(await cache.match(path)))return false;
  return true;
 }catch{return false}
}
function withoutHttpCache(response){
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener("install",e=>{
 e.waitUntil((async()=>{
  // The worker must not activate with an incomplete mandatory shell.
  // Keep the previous cache available if a required asset cannot be fetched.
  const cache=await caches.open(CACHE);
  const assets=await precacheCompleteShell(cache);
  // A completion marker is written last. A partially populated cache cannot
  // claim offline readiness even if the install was interrupted.
  await cache.put(OFFLINE_READY_MARKER,new Response(JSON.stringify(assets)));
  await self.skipWaiting();
 })());
});

self.addEventListener("message",e=>{
 if(e.data?.type==="SKIP_WAITING"){
  e.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   if(await completeCachedShell(cache))await self.skipWaiting();
  })());
 }
 if(e.data?.type==="OFFLINE_CACHE_STATUS"&&e.source?.postMessage){
  e.waitUntil((async()=>{
   let ready=false,assets=0;
   try{
    const cache=await caches.open(CACHE);
    ready=await completeCachedShell(cache);
    if(ready)assets=(await cache.keys()).length-1;
   }catch{}
   e.source.postMessage({type:"OFFLINE_CACHE_STATUS",ready,assets,version:CACHE});
  })());
 }
});

self.addEventListener("activate",e=>{
 e.waitUntil((async()=>{
  const current=await caches.open(CACHE);
  if(!(await completeCachedShell(current)))return;
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith("lumen-assets-")&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});

self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin)return;
 const isNavigation=e.request.mode==="navigate"||url.pathname==="/"||url.pathname.endsWith("/index.html");

 if(isNavigation){
  // Only a public, query-free document is eligible. Auth return URLs and
  // private routes must never enter the shell cache or fall back to it.
  const publicShell=['/','/index.html'].includes(url.pathname)&&url.search==='';
  e.respondWith((async()=>{
   try{
    const response=await fetch(e.request,{cache:'no-store'});
    if(publicShell&&response.ok&&!response.redirected){
     const copy=response.clone();
     e.waitUntil(caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{}));
    }
    return response;
   }catch(error){
    if(publicShell){const cached=await caches.open(CACHE).then(cache=>cache.match(e.request)).catch(()=>undefined);if(cached)return withoutHttpCache(cached)}
    throw error;
   }
  })());
  return;
 }

 // Only public application assets belong in this cache. Other same-origin
 // requests and provider APIs keep their own transport/storage policies.
 if(!url.pathname.startsWith('/src/')&&!url.pathname.startsWith('/content/')&&!SHELL.includes(url.pathname))return;
 e.respondWith((async()=>{
  try{
   // Network-first must bypass the HTTP cache too: a fresh document alone
   // does not invalidate cached native-module imports from an earlier release.
   const response=await fetch(e.request,{cache:"no-store"});
   if(response.ok&&!response.redirected){
    // Prevent the page's resource cache from retaining the worker's response
    // for the next release. The Cache API still holds an explicit offline copy.
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');
    const fresh=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    const copy=fresh.clone();
    e.waitUntil(caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{}));
    return fresh;
   }
   return response;
  }catch(error){
   const cached=await caches.open(CACHE).then(cache=>cache.match(e.request)).catch(()=>undefined);
   if(cached)return withoutHttpCache(cached);
   throw error;
  }
 })());
});

self.addEventListener("push",function(e){
 var d={};
 try{d=e.data?e.data.json():{}}catch(x){}
 e.waitUntil(self.registration.showNotification(d.title||"LUMEN",{
  body:d.body||"Une étoile t’attend.",
  icon:"/icon.svg",
  tag:d.tag||"lumen-return",
  data:{url:d.url||"/"}
 }));
});

self.addEventListener("notificationclick",function(e){
 e.notification.close();
 e.waitUntil(clients.openWindow(e.notification.data&&e.notification.data.url?e.notification.data.url:"/"));
});
