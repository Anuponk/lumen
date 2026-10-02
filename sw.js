const CACHE="lumen-shell-v6";
const SHELL=["/","/index.html","/manifest.webmanifest","/icon.svg","/icon-maskable.svg"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))))});
self.addEventListener("push",function(e){var d={};try{d=e.data?e.data.json():{}}catch(x){};e.waitUntil(self.registration.showNotification(d.title||"LUMEN",{body:d.body||"Une étoile t’attend.",icon:"/icon.svg",tag:"lumen-return",data:{url:d.url||"/"}}))});
self.addEventListener("notificationclick",function(e){e.notification.close();e.waitUntil(clients.openWindow(e.notification.data&&e.notification.data.url?e.notification.data.url:"/"))});
