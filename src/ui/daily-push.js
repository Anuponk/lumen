const SCOPE_PATH='/src/ui/notifications/';
const WORKER_PATH='/src/ui/daily-push-worker.js';
const DEVICE_KEY='lumenDailyPushDeviceV1';
const DISMISS_KEY='lumenDailyPushDismissedV1';
const UNAVAILABLE_RETRY_MS=5*60_000;

export function createDailyPushClient({win,storage=win.localStorage,getOwner,rpc,locale}){
 const workers=win.navigator.serviceWorker,scope=new URL(SCOPE_PATH,win.location.origin).href;
 const supported=!!(workers&&win.PushManager&&win.Notification&&win.crypto?.randomUUID);
 const permission=()=>supported?win.Notification.permission:'unsupported';
 let discovery=null;
 const readDevice=()=>{
  try{return JSON.parse(storage.getItem(DEVICE_KEY))}catch{return null}
 };
 async function request(owner,action,args={}){
  if(!owner||owner!==getOwner())throw new Error('daily_push_account_changed');
  const {data,error}=await rpc('lumen_daily_push_v1',{p_expected_user_id:owner,p_action:action,...args});
  if(error||data?.version!==1||owner!==getOwner())throw new Error('daily_push_unavailable');
  return {...data,owner};
 }
 async function existingRegistration(){
  const registration=await workers.getRegistration(scope);
  return registration?.scope===scope?registration:null;
 }
 async function registrationForDevice(){
  const registration=await existingRegistration()||await workers.register(WORKER_PATH,{scope:SCOPE_PATH,updateViaCache:'none'});
  for(let elapsed=0;elapsed<8000;elapsed+=100){
   if(registration.active?.state==='activated')return registration;
   await new Promise(resolve=>win.setTimeout(resolve,100));
  }
  throw new Error('daily_push_worker_unavailable');
 }
 function setLocalDelivery(registration,enabled){
  if(!registration?.active)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const channels=new win.MessageChannel();
   const timer=win.setTimeout(()=>finish(false),2000);
   function finish(ok){
    win.clearTimeout(timer);channels.port1.close();
    if(ok)resolve();else reject(new Error('daily_push_device_state'));
   }
   channels.port1.onmessage=event=>finish(event.data===true);
   registration.active.postMessage({type:'LUMEN_DAILY_PUSH_LOCAL',enabled},[channels.port2]);
  });
 }
 async function stopLocalDelivery(){
  if(!supported)return;
  const registration=await existingRegistration();
  if(!registration)return;
  try{await setLocalDelivery(registration,false)}
  finally{
   const subscription=await registration.pushManager.getSubscription();
   if(subscription)await subscription.unsubscribe();
  }
 }
 return {
  supported,permission,
  async read(){
   const owner=getOwner(),device=readDevice();
   if(!owner)return null;
   if(discovery?.owner===owner&&Date.now()<discovery.until)return discovery.promise;
   const memo={owner,until:Infinity,promise:null};
   memo.promise=request(owner,'read',device?.owner===owner?{p_device_id:device.id}:{})
    .then(state=>{
     memo.until=state.available||state.dailyEnabled?0:Date.now()+UNAVAILABLE_RETRY_MS;
     return state;
    },()=>{
     // The frontend can be published before the additive database migration.
     memo.until=Date.now()+UNAVAILABLE_RETRY_MS;
     return null;
    });
   discovery=memo;
   return memo.promise;
  },
  async enable(state){
   const owner=getOwner();
   if(!supported||!state?.available||state.owner!==owner||!state.vapidPublicKey)return false;
   // Called from the explicit click handler, before any asynchronous setup.
   if(await win.Notification.requestPermission()!=='granted'||owner!==getOwner())return false;
   let device=readDevice();
   if(device?.owner!==owner){
    if(device)await stopLocalDelivery();
    if(owner!==getOwner())return false;
    device={owner,id:win.crypto.randomUUID()};
    storage.setItem(DEVICE_KEY,JSON.stringify(device));
   }
   const registration=await registrationForDevice();
   const key=Uint8Array.from(win.atob(state.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   if(owner!==getOwner())return false;
   const existing=await registration.pushManager.getSubscription();
   if(existing?.options?.applicationServerKey&&
      !new Uint8Array(existing.options.applicationServerKey).every((value,index)=>value===key[index])){
    // This is the dedicated registration. The root worker's subscription is independent.
    await existing.unsubscribe();
   }
   const subscription=await registration.pushManager.getSubscription()||
    await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   try{
    const result=await request(owner,'enable',{
     p_device_id:device.id,p_expected_revision:state.revision,p_confirm_daily:true,
     p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
     p_locale:locale(),p_subscription:subscription.toJSON()
    });
    if(!result.dailyEnabled||!result.deviceRegistered)throw new Error('daily_push_not_enabled');
    await setLocalDelivery(registration,true);
    if(owner===getOwner())return true;
    await stopLocalDelivery();
    return false;
   }catch(error){
    await stopLocalDelivery().catch(()=>{});
    throw error;
   }
  },
  async disable(state){
   const owner=getOwner(),device=readDevice();
   if(!owner||state?.owner!==owner)return;
   await request(owner,'disable',{
    p_expected_revision:state.revision,
    ...(device?.owner===owner?{p_device_id:device.id}:{})
   });
   if(device?.owner===owner)await stopLocalDelivery();
  },
  async ownerChanged(){
   const device=readDevice();
   if(device&&device.owner!==getOwner())await stopLocalDelivery();
  },
  dismissed(){
   try{return !!getOwner()&&storage.getItem(DISMISS_KEY+':'+getOwner())==='1'}catch{return false}
  },
  dismiss(){
   try{if(getOwner())storage.setItem(DISMISS_KEY+':'+getOwner(),'1')}catch{}
  },
 };
}

export function setupDailyPushSettings({client,document,t}){
 const element=id=>document.getElementById(id);
 const settings=element('dailyPushSettings'),offer=element('dailyPushOffer');
 const enable=element('dailyPushEnable'),disable=element('dailyPushDisable');
 const offerEnable=element('dailyPushOfferEnable'),later=element('dailyPushOfferLater');
 const status=element('dailyPushStatus'),offerStatus=element('dailyPushOfferStatus');
 let state=null,requestId=0,working=false;
 function render(){
  const permission=client.permission();
  settings.hidden=!state?.available&&!state?.dailyEnabled;
  const currentDevice=state?.deviceRegistered&&permission==='granted';
  enable.hidden=!state?.available||permission==='unsupported'||permission==='denied'||!!(state?.dailyEnabled&&currentDevice);
  disable.hidden=!state?.dailyEnabled;
  enable.disabled=disable.disabled=offerEnable.disabled=later.disabled=working;
  status.textContent=t(permission==='unsupported'?'daily.pushUnsupported':permission==='denied'?'daily.pushDenied':
   state?.dailyEnabled&&currentDevice?'daily.pushOn':state?.dailyEnabled?'daily.pushOtherDevice':
   state?.available?'daily.pushOff':'daily.pushUnavailable');
 }
 async function refresh(){
  const id=++requestId;
  try{const next=await client.read();if(id===requestId)state=next}
  catch{if(id===requestId)state=null}
  if(id===requestId)render();
  return id===requestId;
 }
 async function change(action,fromOffer=false){
  if(working||!state)return;
  working=true;render();
  let changed=false;
  try{
   if(action==='enable')changed=await client.enable(state);
   else{await client.disable(state);changed=true}
  }catch{}
  working=false;await refresh();
  if(changed&&fromOffer)offer.hidden=true;
  else if(!changed)(fromOffer?offerStatus:status).textContent=t(client.permission()==='denied'?'daily.pushDenied':'daily.pushError');
 }
 settings.ontoggle=()=>{if(settings.open)void refresh()};
 enable.onclick=()=>change('enable');
 disable.onclick=()=>change('disable');
 offerEnable.onclick=()=>change('enable',true);
 later.onclick=()=>{client.dismiss();offer.hidden=true};
 return {
  accountOpened(){void refresh()},
  async presentResult(eligible){
   offer.hidden=true;offerStatus.textContent='';
   if(!eligible||client.permission()==='unsupported'||client.permission()==='denied'||client.dismissed())return;
   if(await refresh())offer.hidden=!state?.available||state.dailyEnabled;
  },
  ownerChanged(){
   offer.hidden=true;state=null;requestId++;render();
   void client.ownerChanged().catch(()=>{});
   if(settings.open)void refresh();
  },
 };
}
