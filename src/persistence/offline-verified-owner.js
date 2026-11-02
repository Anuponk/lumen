// Owner-bound offline authorization is a continuation of a successful online
// hydration, never an authentication method or a substitute for cloud receipts.
const KEY='lumenOfflineVerifiedOwnerV1';
export function rememberVerifiedOfflineOwner(storage,userId,now=Date.now()){
 if(!userId)return;
 try{storage.setItem(KEY,JSON.stringify({userId,verifiedAt:now}))}catch{}
}
export function clearVerifiedOfflineOwner(storage){try{storage.removeItem(KEY)}catch{}}
export function isVerifiedOfflineOwner(storage,userId,{offline=false,now=Date.now(),maxAge=30*86400000}={}){
 if(!offline||!userId)return false;
 try{
  const record=JSON.parse(storage.getItem(KEY)||'null');
  return record?.userId===userId&&Number.isFinite(record.verifiedAt)&&record.verifiedAt<=now&&now-record.verifiedAt<=maxAge;
 }catch{return false}
}
