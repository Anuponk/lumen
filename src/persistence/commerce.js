// #1030 LUMEN Premium — commerce state and quota reconciliation (client side).
// Free-first (docs/PREMIUM_1030.md): the public switches are read at most once per
// TTL and cached per owner; the account state (Premium, durable activation, day
// counts) is read only when the commercial model or the QA preview applies; the
// quota ledger is synced in batches only while quotas apply to the account.
// No polling, no per-gesture call. A failed read never removes a right already
// confirmed for this account: the cached state stays in force.
import {normalizeCommerceConfig,quotasApply,COMMERCE_DEFAULTS} from '../campaign/premium-quota.js';

export const COMMERCE_CONFIG_TTL_MS=6*3600*1000;

export function createCommerceClient({rpc,ledgerFor,now=()=>Date.now(),onChange=()=>{}}={}){
 let current={owner:null,config:COMMERCE_DEFAULTS,premium:false,premiumSource:null,preview:false,ready:false};
 let flight=null,syncing=null,generation=0;
 const set=next=>{current={...current,...next};onChange(current);return current};

 function fromCache(owner){
  const s=ledgerFor(owner).snapshot();
  return {owner,config:normalizeCommerceConfig(s.config||{}),premium:!!s.premium?.active,premiumSource:s.premium?.source??null,preview:!!s.preview,cachedAt:s.configAt||0};
 }
 // signedIn: verified account owner; previewCapability: from the already loaded
 // internal capabilities (no extra read to know a QA account).
 async function refresh({owner,signedIn=false,previewCapability=false,force=false}={}){
  const id=++generation, ledger=ledgerFor(owner), cached=fromCache(owner);
  set({...cached,preview:signedIn?previewCapability:false,ready:true});
  if(!force&&cached.cachedAt&&now()-cached.cachedAt<COMMERCE_CONFIG_TTL_MS&&!(signedIn&&previewCapability))return current;
  if(flight)return flight;
  flight=(async()=>{
   try{
    const pub=await rpc('lumen_get_commerce_config',{});
    if(id!==generation)return current;
    if(pub.error||!pub.data||typeof pub.data!=='object')throw pub.error||Error('commerce_config_invalid');
    const config=normalizeCommerceConfig(pub.data);
    if(signedIn&&(config.premiumEnabled||previewCapability)){
     const st=await rpc('lumen_get_commerce_state',{p_expected_user_id:owner,p_day:ledger.day()});
     if(id!==generation)return current;
     if(st.error||!st.data)throw st.error||Error('commerce_state_invalid');
     const premium=st.data.premium||{active:false};
     ledger.cacheCommerce({config,premium,preview:!!st.data.preview});
     ledger.acknowledge({counts:st.data.counts||null,activatedAt:st.data.activatedAt||null});
     return set({owner,config,premium:!!premium.active,premiumSource:premium.source??null,preview:!!st.data.preview});
    }
    ledger.cacheCommerce({config,preview:false});
    return set({owner,config,preview:false});
   }catch(error){
    console.warn('LUMEN commerce state',error?.message||error);return current;
   }finally{flight=null}
  })();
  return flight;
 }
 // Batched reconciliation; called after an attempt is counted and at hydration.
 async function sync({owner,signedIn=false}={}){
  if(!signedIn||!owner)return {skipped:'guest'};
  if(!quotasApply(current)) return {skipped:'off'};
  if(syncing)return syncing;
  const ledger=ledgerFor(owner),attempts=ledger.pending(40),activation=ledger.pendingActivation();
  if(!attempts.length&&!activation)return {skipped:'nothing'};
  syncing=(async()=>{
   try{
    const r=await rpc('lumen_quota_sync',{p_expected_user_id:owner,p_day:ledger.day(),p_attempts:attempts,p_activation:activation});
    if(r.error||!r.data)throw r.error||Error('quota_sync_invalid');
    if(current.owner!==owner)return {skipped:'account_changed'};
    ledger.acknowledge({attemptIds:attempts.map(a=>a.attemptId),counts:r.data.counts||null,activatedAt:r.data.activatedAt||null,activationSent:!!activation});
    if(r.data.premium){ledger.cacheCommerce({premium:r.data.premium});set({premium:!!r.data.premium.active,premiumSource:r.data.premium.source??null})}
    return {ok:true,accepted:r.data.accepted};
   }catch(error){
    // Pending attempts stay counted locally and are resent later (idempotent).
    console.warn('LUMEN quota sync',error?.message||error);return {ok:false};
   }finally{syncing=null}
  })();
  return syncing;
 }
 function reset(){generation++;set({owner:null,config:COMMERCE_DEFAULTS,premium:false,premiumSource:null,preview:false,ready:false})}
 return {refresh,sync,reset,get state(){return current}};
}

// Premium-only surfaces: visible to a Premium account (acquired rights are never
// hidden), otherwise only once the commercial model is public and the player has
// reached the threshold, or in QA preview. Never during the discovery phase.
export function premiumSurfaceVisible({state,feature,activated=false}={}){
 if(!state)return false;
 const on=feature?!!state.config?.[feature]:true;
 if(state.premium&&(state.config?.premiumEnabled||state.preview))return on||state.preview;
 if(state.preview)return true;
 return !!(state.config?.premiumEnabled&&on&&activated);
}
