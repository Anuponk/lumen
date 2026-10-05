const CACHE="lumen-assets-v9";
const SHELL=["/manifest.webmanifest","/icon.svg","/icon-maskable.svg"];

self.addEventListener("install",e=>{
 self.skipWaiting();
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});

self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting()});

self.addEventListener("activate",e=>{
 e.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const url=new URL(e.request.url);
 const isNavigation=e.request.mode==="navigate"||url.pathname==="/"||url.pathname.endsWith("/index.html");

 if(isNavigation){
  e.respondWith(fetch(e.request,{cache:"no-store"}));
  return;
 }

 e.respondWith(
  fetch(e.request)
   .then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return r;
   })
   .catch(()=>caches.match(e.request))
 );
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
