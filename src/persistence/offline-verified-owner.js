// Owner-bound offline authorization is a continuation of a successful online
// hydration, never an authentication method or a substitute for cloud receipts.
const KEY='lumenOfflineVerifiedOwnerV1';
export function rememberVerifiedOfflineOwner(storage,userId,now=Date.now(),wallet){
 if(!userId)return;
 const balance=Number.isSafeInteger(wallet?.shards)&&wallet.shards>=0?wallet.shards:undefined;
 try{storage.setItem(KEY,JSON.stringify({userId,verifiedAt:now,...(balance===undefined?{}:{balance})}))}catch{}
}
export function verifiedOfflineWallet(storage,userId,options){
 if(!isVerifiedOfflineOwner(storage,userId,options))return null;
 try{const record=JSON.parse(storage.getItem(KEY));return Number.isSafeInteger(record.balance)&&record.balance>=0?record.balance:null}catch{return null}
}
export function preparedOfflineUser(storage,options){
 try{const owner=storage.getItem('lumenCloudOwnerId');return isVerifiedOfflineOwner(storage,owner,options)?{id:owner}:null}catch{return null}
}
export function clearVerifiedOfflineOwner(storage){try{storage.removeItem(KEY)}catch{}}
export function isVerifiedOfflineOwner(storage,userId,{offline=false,now=Date.now(),maxAge=30*86400000}={}){
 if(!offline||!userId)return false;
 try{
  const record=JSON.parse(storage.getItem(KEY)||'null');
  return record?.userId===userId&&Number.isFinite(record.verifiedAt)&&record.verifiedAt<=now&&now-record.verifiedAt<=maxAge;
 }catch{return false}
}
