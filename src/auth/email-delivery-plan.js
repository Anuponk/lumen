import {resolveAuthEmailBrand} from "./email-brand-routing.js";
const ACTIONS=new Set(["signup","magiclink","recovery","invite","email_change","reauthentication","email"]);
const safeEmail=value=>typeof value==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function planAuthEmails(payload){
 const {brand,reason}=resolveAuthEmailBrand(payload?.email_data?.redirect_to);
 if(!brand)return {ok:false,reason};
 const data=payload?.email_data||{},user=payload?.user||{},action=data.email_action_type;
 if(!ACTIONS.has(action))return {ok:false,reason:"unsupported_action"};
 const to=[];
 if(action==="email_change"){
  if(!safeEmail(user.new_email))return {ok:false,reason:"invalid_new_email"};
  if(data.token_hash_new){
   if(!safeEmail(user.email)||!data.token||!data.token_new||!data.token_hash)return {ok:false,reason:"incomplete_secure_change"};
   to.push({email:user.email,token:data.token,role:"current"});
   to.push({email:user.new_email,token:data.token_new,role:"new"});
  }else{
   const token=data.token_new||data.token;
   if(!token||!data.token_hash)return {ok:false,reason:"incomplete_change"};
   to.push({email:user.new_email,token,role:"new"});
  }
 }else{
  if(!safeEmail(user.email)||!data.token)return {ok:false,reason:"invalid_recipient_or_token"};
  to.push({email:user.email,token:data.token,role:"primary"});
 }
 if(to.some(x=>typeof x.token!=="string"||!/^\d{4,12}$/.test(x.token)))return {ok:false,reason:"invalid_token"};
 return {ok:true,brand,action,deliveries:to};
}
