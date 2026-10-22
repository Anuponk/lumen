const CACHE="lumen-assets-v10";
const SHELL=["/manifest.webmanifest","/icon.svg","/icon-maskable.svg","/"];

self.addEventListener("install",e=>{
 self.skipWaiting();
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});

self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting()});

self.addEventListener("activate",e=>{
 e.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(k=>k.startsWith("lumen-assets-")&&k!==CACHE).map(k=>caches.delete(k))))
   .then(()=>self.clients.claim())
 );
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
    if(publicShell&&response.ok){
     const copy=response.clone();
     e.waitUntil(caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{}));
    }
    return response;
   }catch(error){
    if(publicShell){const cached=await caches.open(CACHE).then(cache=>cache.match(e.request)).catch(()=>undefined);if(cached)return cached}
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
   if(response.ok){
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
   if(cached)return cached;
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
