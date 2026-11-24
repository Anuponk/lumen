// Deploy with --no-verify-jwt. The job has its own Bearer secret and no user API.
import webpush from 'npm:web-push@3.6.7';
import {dailyPushDispatcher} from '../_shared/lumen-daily-push-dispatch.js';

const endpoint=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const secret=Deno.env.get('LUMEN_DAILY_PUSH_JOB_TOKEN');
const subject=Deno.env.get('LUMEN_DAILY_PUSH_VAPID_SUBJECT')??'';
const publicKey=Deno.env.get('LUMEN_DAILY_PUSH_VAPID_PUBLIC_KEY')??'';
const privateKey=Deno.env.get('LUMEN_DAILY_PUSH_VAPID_PRIVATE_KEY')??'';
let validKeys=false;
try{webpush.setVapidDetails(subject,publicKey,privateKey);validKeys=true}catch{}

async function rpc(name:string,args:Record<string,unknown>={}){
 const response=await fetch(endpoint+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:serviceKey??'',Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
  body:JSON.stringify(args),signal:AbortSignal.timeout(5000)
 });
 if(!response.ok)throw new Error('daily_push_rpc');
 return response.json();
}

type Reservation = {reservationId:string};
type Subscription = {endpoint:string;keys:{p256dh:string;auth:string}};

Deno.serve(dailyPushDispatcher({
 secret,publicKey,configured:!!(endpoint&&serviceKey&&validKeys),
 reserve:(limit:number)=>rpc('lumen_reserve_daily_push_v1',{p_limit:limit}),
 start:(claim:Reservation)=>rpc('lumen_authorize_daily_push_v1',{p_reservation_id:claim.reservationId}),
 settle:(claim:Reservation,outcome:string)=>rpc('lumen_finish_daily_push_v1',{p_reservation_id:claim.reservationId,p_outcome:outcome}),
 cleanup:()=>rpc('lumen_cleanup_daily_push_v1'),
 send:async(subscription:Subscription,payload:Record<string,unknown>,ttl:number)=>{
  try{
   const result=await webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:ttl,timeout:4000});
   return result.statusCode;
  }catch(error){
   if(error&&typeof error==='object'&&'statusCode' in error&&typeof error.statusCode==='number')return error.statusCode;
   throw new Error('daily_push_provider_unavailable');
  }
 }
}));
