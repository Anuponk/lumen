/* Dedicated Daily Challenge registration. The root worker keeps its own subscription. */
const STATE_CACHE='lumen-daily-push-local-v1';
const STATE_URL=new URL('/src/ui/notifications/device-state',self.location.origin).href;
const localState=()=>caches.open(STATE_CACHE);

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='LUMEN_DAILY_PUSH_LOCAL'||typeof event.data.enabled!=='boolean'||!event.ports[0])return;
 event.waitUntil((async()=>{
  const cache=await localState();
  if(event.data.enabled)await cache.put(STATE_URL,new Response('1'));
  else await cache.delete(STATE_URL);
  event.ports[0].postMessage(true);
 })());
});
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  const cache=await localState();
  if(!await cache.match(STATE_URL))return;
  let data;
  try{data=event.data?.json()}catch{return}
  if(data?.type!=='daily-challenge'||!/^\d{4}-\d{2}-\d{2}$/.test(data.day)||
     !Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now()||
     typeof data.title!=='string'||typeof data.body!=='string')return;
  await self.registration.showNotification(data.title,{
   body:data.body,icon:'/icon.svg',tag:'lumen-daily-'+data.day,
   data:{expiresAt:data.expiresAt}
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 if(event.notification.data?.expiresAt>Date.now()){
  event.waitUntil(self.clients.openWindow(new URL('/?daily=1',self.location.origin).href));
 }
});
