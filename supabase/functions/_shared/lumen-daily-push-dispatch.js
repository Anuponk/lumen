import {timingSafeEqual} from 'node:crypto';

const encode=new TextEncoder();
const BATCH_LIMIT=20;
const PARALLEL_SENDS=4;
const providers=new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']);
import {dailyPresentation} from '../../../src/campaign/seasonal-events.js';

const copy={
 fr:{title:'Défi du jour',body:'Une nouvelle grille t’attend dans Lumen.'},
 en:{title:'Daily Challenge',body:'A new puzzle is waiting for you in Lumen.'},
 es:{title:'Reto del día',body:'Te espera una nueva cuadrícula en Lumen.'}
};
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

function approvedEndpoint(endpoint){
 try{
  const url=new URL(endpoint);
  return url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&!url.hash&&providers.has(url.hostname);
 }catch{return false}
}
function accepts(header,secret){
 if(typeof secret!=='string'||secret.length<32)return false;
 const actual=encode.encode(header||''),expected=encode.encode('Bearer '+secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export function dailyPushDispatcher({secret,configured,publicKey,reserve,start,settle,startTest,settleTest,cleanup,send,now=Date.now}){
 return async request=>{
  if(request.method!=='POST')return reply(405,{status:'method_not_allowed'});
  if(!configured||typeof secret!=='string'||secret.length<32)return reply(503,{status:'unavailable'});
  if(!accepts(request.headers.get('Authorization'),secret))return reply(401,{status:'unauthorized'});
  const params=new URL(request.url).searchParams;
  const cleanupOnly=params.get('action')==='cleanup';
  const testOnly=params.get('action')==='test';
  if(params.size&&((!cleanupOnly&&!testOnly)||params.size!==1))return reply(400,{status:'invalid_action'});
  let testClaim;
  if(testOnly){
   if(!startTest||!settleTest)return reply(503,{status:'unavailable'});
   try{
    // Bound request parsing before reading any ticket or subscription.
    const reader=request.body?.getReader();
    if(!reader)throw Error();
    let bytes=new Uint8Array();
    while(true){const {value,done}=await reader.read();if(done)break;
     if(bytes.length+value.length>256){await reader.cancel();throw Error()}
     bytes=new Uint8Array([...bytes,...value]);
    }
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(typeof data.reservationId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.reservationId))throw Error();
    testClaim={reservationId:data.reservationId};
   }catch{return reply(400,{status:'invalid_request'})}
  }
  const counts={reserved:0,sent:0,skipped:0,expired:0,rejected:0,ambiguous:0,failed:0};
  try{
   if(cleanupOnly){await cleanup();return reply(200,{status:'cleaned'})}
   const claims=testOnly?[testClaim]:await reserve(BATCH_LIMIT);
   counts.reserved=claims.length;
   const dispatch=async claim=>{
    let outcome='ambiguous';
    try{
     // Only a reservation that enters the sending state can make a provider call.
     const delivery=await (testOnly?startTest:start)(claim);
     if(!delivery){counts.skipped++;return}
     const {challengeDay:day,expiresAt,locale,subscription,vapidPublicKey}=delivery;
     const expiry=typeof expiresAt==='number'?expiresAt:Date.parse(expiresAt);
     const ttl=Math.floor((expiry-now())/1000);
     if(vapidPublicKey!==publicKey||!approvedEndpoint(subscription?.endpoint)||!Number.isFinite(ttl)||ttl<=0||
        !/^\d{4}-\d{2}-\d{2}$/.test(day)||!Object.hasOwn(copy,locale))outcome='rejected';
     else{
      const payload={type:'daily-challenge',day,expiresAt:expiry,...copy[locale],title:dailyPresentation(day,locale).title};
      if(testOnly){payload.type='daily-challenge-test';payload.testId=claim.reservationId;payload.title=({fr:'Test · ',en:'Test · ',es:'Prueba · '})[locale]+payload.title}
      const status=await send(subscription,payload,Math.min(3600,ttl));
      outcome=status===404||status===410?'expired':status>=200&&status<300?'sent':'ambiguous';
     }
    }catch{}
    try{await (testOnly?settleTest:settle)(claim,outcome);counts[outcome]++}catch{counts.failed++}
   };
   for(let i=0;i<claims.length;i+=PARALLEL_SENDS)
    await Promise.all(claims.slice(i,i+PARALLEL_SENDS).map(dispatch));
   return reply(counts.failed?503:200,counts);
  }catch{
   return reply(503,{status:'batch_unavailable'});
  }
 };
}
