// Explicit migration backup. Never automatically overwrites a cloud snapshot.
const MAX_CHARS=524288;
export function validateCloudProfile(profile){
  if(!profile || typeof profile!=="object" || Array.isArray(profile)) throw Error("Profil invalide");
  if(!profile.solved || typeof profile.solved!=="object" || Array.isArray(profile.solved)) throw Error("Quêtes invalides");
  if(!profile.badges || typeof profile.badges!=="object" || Array.isArray(profile.badges)) throw Error("Badges invalides");
  const json=JSON.stringify(profile);
  if(!json || json.length>MAX_CHARS) throw Error("Sauvegarde trop volumineuse");
  return JSON.parse(json);
}
export async function backupAndVerifyProfile(supabase,profile){
  const snapshot=validateCloudProfile(profile);
  const {error:writeError}=await supabase.rpc("lumen_backup_profile",{p_payload:snapshot});
  if(writeError)throw Error("Sauvegarde cloud refusée : "+writeError.message);
  const {data,error:readError}=await supabase.rpc("lumen_restore_profile");
  if(readError)throw Error("Vérification cloud impossible : "+readError.message);
  if(JSON.stringify(data)!==JSON.stringify(snapshot)){
    // JSONB may reorder fields: compare stable normalized structure instead.
    const canonical=(v)=>JSON.stringify(sortKeys(v));
    if(canonical(data)!==canonical(snapshot)) throw Error("Sauvegarde cloud non vérifiée");
  }
  return {ok:true,solved:Object.values(snapshot.solved).filter(Boolean).length};
}
function sortKeys(value){
  if(Array.isArray(value))return value.map(sortKeys);
  if(value && typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortKeys(value[k])]));
  return value;
}

// Guard full-profile writes against stale devices. Never upload a profile if the
// cloud changed since the last verified read. A true atomic compare-and-swap
// requires a server-side RPC and is tracked separately.
export function sameCloudProfile(a,b){
  return JSON.stringify(sortKeys(a))===JSON.stringify(sortKeys(b));
}
export async function backupIfUnchanged(supabase,profile,expectedRemote){
  const actual=await loadVerifiedProfile(supabase);
  if(!sameCloudProfile(actual,expectedRemote))throw Error("Sauvegarde cloud modifiée sur un autre appareil : écriture bloquée");
  await backupAndVerifyProfile(supabase,profile);
  return validateCloudProfile(profile);
}

export async function loadVerifiedProfile(supabase){
  const {data,error}=await supabase.rpc("lumen_restore_profile");
  if(error)throw Error("Impossible de restaurer le profil : "+error.message);
  return data==null?null:validateCloudProfile(data);
}

export function restoreIntoEmptyGuestStorage(storage,remote){
  const incoming=validateCloudProfile(remote);
  const key="lumenProgressV1";
  const raw=storage.getItem(key);
  let current=null;
  if(raw){try{current=JSON.parse(raw)}catch{throw Error("Sauvegarde locale illisible : restauration bloquée")}}
  if(current && typeof current==="object" && (
      Object.values(current.solved||{}).some(Boolean) ||
      Object.keys(current.badges||{}).length>0 ||
      Object.keys(current.performances||{}).length>0 ||
      Object.keys(current.stars||{}).length>0 ||
      Number(current.xp||0)>0 ||
      Number(current.shards||3)>3
  ))throw Error("Progression déjà présente sur cet appareil. Restauration refusée pour éviter tout écrasement");
  const snapshot=JSON.stringify(incoming);
  if(raw!==null) storage.setItem("lumenBeforeCloudRestore_"+Date.now(),raw);
  storage.setItem(key,snapshot);
  if(storage.getItem(key)!==snapshot)throw Error("La vérification de l'enregistrement local a échoué");
  return {solved:Object.values(incoming.solved).filter(Boolean).length};
}

/**
 * Restore a richer cloud profile only when no local achievement can be lost.
 * Monetary balances are NOT merged: the full remote snapshot must be at least
 * as high, and local progress is archived before replacement.
 */
// Legacy autonomous victory progress is monotonic: a win already earned must
// never be discarded. Accept only counters or per-quest boolean/counter maps.
// Unknown shapes remain blocked rather than guessing at reward transactions.
export function mergeAutonomousWins(local,cloud){
 if(local==null)return {ok:true,value:structuredClone(cloud??{})};
 if(cloud==null)return {ok:true,value:structuredClone(local)};
 if(sameCloudProfile(local,cloud))return {ok:true,value:structuredClone(cloud)};
 const counter=x=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=0;
 if(counter(local)&&counter(cloud))return {ok:true,value:Math.max(local,cloud)};
 const map=x=>x&&typeof x==="object"&&!Array.isArray(x);
 if(map(local)&&map(cloud)){
  const result={...structuredClone(cloud)};
  for(const [key,value] of Object.entries(local)){
   if(!Object.hasOwn(result,key)){if(typeof value==="boolean"||counter(value))result[key]=value;else return {ok:false};continue}
   const other=result[key];
   if(typeof value==="boolean"&&typeof other==="boolean")result[key]=value||other;
   else if(counter(value)&&counter(other))result[key]=Math.max(value,other);
   else return {ok:false};
  }
  for(const value of Object.values(result))if(typeof value!=="boolean"&&!counter(value))return {ok:false};
  return {ok:true,value:result};
 }
 return {ok:false};
}
// Legacy Adventure grants are monotonic identifiers, never a numeric campaign limit.
// Malformed or contradictory representations must block rather than lose access.
function mergeLegacyAdventureAccess(local,cloud){
 const valid=value=>value==null||(Array.isArray(value)&&value.every(id=>typeof id==="string"&&id.length>0));
 if(!valid(local)||!valid(cloud))return {ok:false};
 if(local==null&&cloud==null)return {ok:true,value:undefined};
 return {ok:true,value:[...new Set([...(cloud||[]),...(local||[])])]};
}
const qualificationFields=["lastQualifiedAt","lastQualifiedDay"];
function qualificationMetadata(performance){
 return Object.fromEntries(qualificationFields.filter(key=>Object.hasOwn(performance,key)).map(key=>[key,performance[key]]));
}
function validQualificationDay(day){
 return typeof day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
}
// Cooldown metadata is not an immutable reward receipt. Keep the latest known
// qualification and its local calendar day, without replaying any reward.
function mergeQualificationMetadata(left,right){
 const times=[];
 for(const record of [left,right]){
  const at=record.lastQualifiedAt,day=record.lastQualifiedDay;
  if(at!=null&&(typeof at!=="string"||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(at)||!validQualificationDay(at.slice(0,10))||!Number.isFinite(Date.parse(at))))
   return {ok:false,conflictKeys:["lastQualifiedAt"]};
  if(day!=null&&!validQualificationDay(day))
   return {ok:false,conflictKeys:["lastQualifiedDay"]};
  times.push(at==null?-Infinity:Date.parse(at));
 }
 // For equal instants (or legacy day-only records), use a stable day/string
 // tie-breaker so swapping devices cannot produce a different reconciliation.
 const rank=record=>(record.lastQualifiedDay??"")+" "+(record.lastQualifiedAt??"");
 const winner=times[0]>times[1]?left:times[1]>times[0]?right:rank(left)>rank(right)?left:right;
 const value={};
 for(const key of qualificationFields){
  if(Object.hasOwn(left,key)||Object.hasOwn(right,key))value[key]=winner[key]??null;
 }
 return {ok:true,value};
}
export function cloudSafelyCoversLocal(local,remote){
  if(!local || typeof local!=="object" || Array.isArray(local))return true;
  const cloud=validateCloudProfile(remote);
  const grants=mergeLegacyAdventureAccess(local.legacyAdventureAccess,cloud.legacyAdventureAccess);
  if(!grants.ok||grants.value?.some(id=>!cloud.legacyAdventureAccess?.includes(id)))return false;
  const autonomy=mergeAutonomousWins(local.autonomousWins,cloud.autonomousWins);
  if(!autonomy.ok||!sameCloudProfile(autonomy.value,cloud.autonomousWins??{}))return false;
  for(const field of ["shards","xp","skyScore"]){
    if(Number(local[field]||0)>Number(cloud[field]||0))return false;
  }
  for(const field of ["solved","historyBackup","badges","stars","noHint"]){
    for(const [key,value] of Object.entries(local[field]||{})){
      if(value && !cloud[field]?.[key])return false;
    }
  }
  // Canonical quest rewards must never be dropped during a cloud restore.
  // A remote state must include each completed stable quest and its exact
  // reward snapshot before it may replace the local device profile.
  for(const [id,entry] of Object.entries(local.canonicalQuestState||{})){
    if(!entry?.solved)continue;
    const saved=cloud.canonicalQuestState?.[id];
    if(!saved?.solved||!sameCloudProfile(entry,saved))return false;
  }
  for(const [key,perf] of Object.entries(local.performances||{})){
    const saved=cloud.performances?.[key];
    if(!saved)return false;
    const qualification=mergeQualificationMetadata(perf,saved);
    if(!qualification.ok||!sameCloudProfile(qualification.value,qualificationMetadata(saved)))return false;
    for(const [badge,earned] of Object.entries(perf.badges||{}))
      if(earned && !saved.badges?.[badge])return false;
    const localBest=Number(perf.bestTime);
    const remoteBest=Number(saved.bestTime);
    if(Number.isFinite(localBest)&&localBest>0&&(!Number.isFinite(remoteBest)||remoteBest>localBest))return false;
  }
  // Dates and challenges may contain non-repeatable rewards and are not safely
  // unionable. Require equivalent values to avoid silent drops.
  for(const field of ["daily","challenges"]){
    const current=local[field];
    if(current && Object.keys(current).length && !sameCloudProfile(current,cloud[field]||{}))return false;
  }
  return true;
}
export function restoreRicherCloudProfile(storage,remote){
  const incoming=validateCloudProfile(remote);
  const key="lumenProgressV1";
  const raw=storage.getItem(key);
  if(!raw)return restoreIntoEmptyGuestStorage(storage,incoming);
  let local;
  try{local=JSON.parse(raw)}catch{throw Error("Sauvegarde locale illisible : restauration bloquée")}
  if(sameCloudProfile(local,incoming))return {changed:false};
  if(!cloudSafelyCoversLocal(local,incoming))throw Error("Profil local divergent : restauration automatique suspendue");
  const backupKey="lumenBeforeCloudRestore_"+Date.now();
  storage.setItem(backupKey,raw);
  if(storage.getItem(backupKey)!==raw)throw Error("Impossible de conserver la sauvegarde locale");
  const snapshot=JSON.stringify(incoming);
  storage.setItem(key,snapshot);
  if(storage.getItem(key)!==snapshot){
    storage.setItem(key,raw);
    throw Error("Restauration locale non vérifiée");
  }
  return {changed:true,backupKey};
}

/**
 * Apply only monotonic achievements from the cloud to the local device.
 * Never guess which mutable currency balance or XP is authoritative.
 * Never write back to the cloud as part of this reconciliation.
 */
export function reconcileCloudAchievements(storage,remote){
  const cloud=validateCloudProfile(remote);
  const key="lumenProgressV1";
  const raw=storage.getItem(key);
  if(raw===null)return restoreIntoEmptyGuestStorage(storage,cloud);
  let local;
  try{local=JSON.parse(raw)}catch{throw Error("Profil local illisible : aucun changement")}
  if(!local||typeof local!=="object"||Array.isArray(local))throw Error("Profil local invalide");
  const merged=structuredClone(local);
  let changed=false;
  for(const field of ["solved","historyBackup"]){
    if(!merged[field]||typeof merged[field]!=="object")merged[field]={};
    for(const [quest,done] of Object.entries(cloud[field]||{})){
      if(done&&!merged[field][quest]){merged[field][quest]=done;changed=true}
    }
  }
  merged.performances=merged.performances||{};
  for(const [quest,incoming] of Object.entries(cloud.performances||{})){
    if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))continue;
    const current=merged.performances[quest];
    if(!current){
      merged.performances[quest]=structuredClone(incoming);
      changed=true;
      continue;
    }
    const existingBadges=current.badges||{};
    const nextBadges={...existingBadges};
    for(const [badge,earned] of Object.entries(incoming.badges||{})){
      if(earned&&!nextBadges[badge]){nextBadges[badge]=true;changed=true}
    }
    const localTime=Number(current.bestTime);
    const cloudTime=Number(incoming.bestTime);
    if(Number.isFinite(cloudTime)&&cloudTime>0&&
       (!Number.isFinite(localTime)||localTime<=0||cloudTime<localTime)){
      current.bestTime=incoming.bestTime;
      changed=true;
    }
    if(changed&&JSON.stringify(nextBadges)!==JSON.stringify(existingBadges))current.badges=nextBadges;
  }
  // Global badges can be scalar flags or structured objects: add only missing
  // top-level rewards, never overwrite existing local values.
  merged.badges=merged.badges||{};
  for(const [name,value] of Object.entries(cloud.badges||{})){
    if(!Object.hasOwn(merged.badges,name)){merged.badges[name]=structuredClone(value);changed=true}
  }
  // New-quest achievements are immutable rewards keyed by stable IDs.
  // Never replace an existing local reward with a different cloud snapshot:
  // fail closed so neither device loses an achievement or currency record.
  const localCanonical=merged.canonicalQuestState||{},remoteCanonical=cloud.canonicalQuestState||{};
  for(const [id,entry] of Object.entries(remoteCanonical)){
    if(!entry?.solved)continue;
    if(localCanonical[id]?.solved){
      if(!sameCloudProfile(localCanonical[id],entry))throw Error("Conflit de récompense de quête canonique : "+id);
    }else{
      localCanonical[id]=structuredClone(entry);changed=true;
    }
  }
  if(Object.keys(localCanonical).length)merged.canonicalQuestState=localCanonical;
  if(!changed)return {changed:false,currencyConflict:Number(local.shards)!==Number(cloud.shards)};
  const backupKey="lumenBeforeCloudReconcile_"+Date.now();
  storage.setItem(backupKey,raw);
  if(storage.getItem(backupKey)!==raw)throw Error("Sauvegarde locale préalable impossible");
  const payload=JSON.stringify(merged);
  storage.setItem(key,payload);
  if(storage.getItem(key)!==payload){
    storage.setItem(key,raw);
    throw Error("Échec de vérification de la réconciliation");
  }
  return {changed:true,backupKey,currencyConflict:Number(local.shards)!==Number(cloud.shards)};
}

export async function initializeCloudProfile(supabase,localProfile){
 const proposed=validateCloudProfile(localProfile);
 const {data,error}=await supabase.rpc("lumen_initialize_profile",{p_payload:proposed});
 if(error)throw Error("Initialisation cloud impossible : "+error.message);
 const saved=validateCloudProfile(data);
 const verified=await loadVerifiedProfile(supabase);
 if(!sameCloudProfile(saved,verified))throw Error("Profil cloud initial non vérifié");
 return saved;
}
export async function compareAndSwapCloudProfile(supabase,profile,expected){
 const next=validateCloudProfile(profile),baseline=validateCloudProfile(expected);
 const {data,error}=await supabase.rpc("lumen_cas_profile",{p_expected:baseline,p_payload:next});
 if(error)throw Error("Sauvegarde cloud impossible : "+error.message);
 if(data!==true)throw Error("Conflit de version cloud : sauvegarde refusée");
 return next;
}
// Reuse an existing verified backup instead of multiplying full snapshots on retries.
function preserveVerifiedSnapshot(storage,prefix,value){
 const existing=[];
 if(typeof storage.key==="function"&&Number.isFinite(storage.length)){
  for(let i=0;i<storage.length;i++){
   const key=storage.key(i);
   if(key?.startsWith(prefix))existing.push(key);
  }
 }
 for(const key of existing){if(storage.getItem(key)===value)return key}
 const key=prefix+Date.now();
 try{
  storage.setItem(key,value);
  if(storage.getItem(key)!==value)throw Error("Recovery snapshot verification failed");
 }catch(error){
  if(error?.name==="QuotaExceededError"||error?.code===22||error?.code===1014){
   const quota=new Error("Recovery snapshot storage quota exceeded; originals preserved");
   quota.code="LOCAL_STORAGE_QUOTA";quota.stage="cloud_local_backup";throw quota;
  }
  throw error;
 }
 return key;
}
// IndexedDB is a separate quota pool from localStorage. Never proceed with a
// cloud write unless BOTH recovery snapshots were read back successfully.
async function preserveRecoverySnapshot(storage,prefix,value){
 try{return preserveVerifiedSnapshot(storage,prefix,value)}
 catch(error){if(error?.code!=="LOCAL_STORAGE_QUOTA")throw error}
 if(typeof indexedDB==="object"&&indexedDB&&typeof indexedDB.open==="function"){
  const database=await new Promise((resolve,reject)=>{
   const request=indexedDB.open("lumenCloudRecoveryV1",1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("snapshots"))request.result.createObjectStore("snapshots")};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error("IndexedDB recovery open failed"));
  });
  try{
   // Content-addressed keys avoid accumulating identical full backups on retries.
   let hash=2166136261;
   for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}
   const key=prefix+(hash>>>0).toString(16)+"_"+value.length;
   await new Promise((resolve,reject)=>{
    const tx=database.transaction("snapshots","readwrite");
    tx.objectStore("snapshots").put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error("Recovery write failed"));
    tx.onabort=()=>reject(tx.error||Error("Recovery write aborted"));
   });
   const saved=await new Promise((resolve,reject)=>{
    const tx=database.transaction("snapshots","readonly");
    const request=tx.objectStore("snapshots").get(key);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error("Recovery verification failed"));
   });
   if(saved!==value)throw Error("IndexedDB recovery verification mismatch");
   return "indexeddb:"+key;
  }finally{database.close()}
 }
 const error=Error("No verified recovery storage available; cloud write blocked");
 error.code="RECOVERY_STORAGE_UNAVAILABLE";throw error;
}

export function installCloudProfileLocally(storage,cloud){
 const verified=validateCloudProfile(cloud),key="lumenProgressV1";
 const current=storage.getItem(key),json=JSON.stringify(verified);
 if(current===json)return false;
 // Never replace an unsynced local victory with a stale cloud snapshot.
 if(current!==null){
  let previous;
  try{previous=JSON.parse(current)}catch{throw Error("Profil local illisible : aucune restauration automatique")}
  if(!cloudSafelyCoversLocal(previous,verified))throw Error("Profil local divergent : copie cloud suspendue pour préserver les acquis");
 }
 // A semantically identical cloud profile needs no migration backup or rewrite.
 if(current!==null){
  try{if(sameCloudProfile(JSON.parse(current),verified))return false}catch(_){}
 }
 const backup=current!==null?"lumenBeforeCloudAuthority_":null;
 try{
  if(backup){
   preserveVerifiedSnapshot(storage,backup,current);
  }
  storage.setItem(key,json);
  if(storage.getItem(key)!==json)throw Error("Copie locale du profil cloud non vérifiée");
 }catch(error){
  // When cloud fully covers the local state, a full localStorage quota must not
  // prevent authentication. Keep all backups untouched and run cloud-first in memory.
  // On the next login we retry local installation without losing cloud authority.
  if(error?.name==="QuotaExceededError"||error?.code===22||error?.code===1014||error?.code==="LOCAL_STORAGE_QUOTA"){
   if(current===null||cloudSafelyCoversLocal(JSON.parse(current),verified))return "memory_only";
   const quota=new Error("Stockage local saturé : sauvegardes intactes, libérer de l'espace avant restauration");
   quota.code="LOCAL_STORAGE_QUOTA";quota.stage=backup?"cloud_local_backup":"cloud_local_install";
   throw quota;
  }
  throw error;
 }
 return true;
}

/**
 * Reconcile only when the local snapshot contains every remote achievement and
 * immutable/mutable ledgers are identical. Never infer shard/XP transactions.
 * Preserve verified copies of BOTH sides before any server write.
 */
export async function reconcileDominantLocalProfile(supabase,storage,remote){
 const cloud=validateCloudProfile(remote),raw=storage.getItem("lumenProgressV1");
 if(!raw)return {status:"blocked",reason:"missing_local"};
 let local;
 try{local=validateCloudProfile(JSON.parse(raw))}catch{return {status:"blocked",reason:"invalid_local"}}
 if(!cloudSafelyCoversLocal(cloud,local))return {status:"blocked",reason:"missing_cloud_achievements"};
 for(const field of ["shards","xp","skyScore"]){
  if(Number(local[field]||0)!==Number(cloud[field]||0))return {status:"blocked",reason:"mutable_balance"};
 }
 for(const field of ["daily","challenges"]){
  if(!sameCloudProfile(local[field]||{},cloud[field]||{}))return {status:"blocked",reason:"mutable_ledger"};
 }
 // Unknown fields can contain non-repeatable transactions. Require equality
 // instead of silently selecting one profile's value.
 const monotonic=new Set(["solved","historyBackup","badges","stars","noHint","performances","canonicalQuestState","autonomousWins","legacyAdventureAccess"]);
 for(const key of new Set([...Object.keys(local),...Object.keys(cloud)])){
  if(monotonic.has(key)||["shards","xp","skyScore","daily","challenges"].includes(key))continue;
  if(!sameCloudProfile(local[key]??null,cloud[key]??null))return {status:"blocked",reason:"unclassified_field",fields:[key]};
 }
 const grants=mergeLegacyAdventureAccess(local.legacyAdventureAccess,cloud.legacyAdventureAccess);
 if(!grants.ok||!sameCloudProfile(grants.value??null,local.legacyAdventureAccess??null))return {status:"blocked",reason:"legacy_adventure_access_conflict",fields:["legacyAdventureAccess"]};
 const autonomy=mergeAutonomousWins(local.autonomousWins,cloud.autonomousWins);
 if(!autonomy.ok||!sameCloudProfile(autonomy.value,local.autonomousWins??{}))return {status:"blocked",reason:"autonomous_wins_conflict",fields:["autonomousWins"]};
 if(sameCloudProfile(local,cloud))return {status:"identical"};
 await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileLocal_",raw);
 await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileRemote_",JSON.stringify(cloud));
 // CAS refuses overwrite when another device changed cloud after our read.
 const written=await compareAndSwapCloudProfile(supabase,local,cloud);
 const verified=await loadVerifiedProfile(supabase);
 if(!sameCloudProfile(verified,written))throw Error("Reconciliation cloud non verifiee");
 return {status:"reconciled",profile:verified};
}

/** Conservative two-way reconciliation. Uncertain rewards are never inferred. */
export async function reconcileCompatibleCloudProfiles(supabase,storage,remote){
 const cloud=validateCloudProfile(remote),raw=storage.getItem("lumenProgressV1");
 if(!raw)return {status:"blocked",reason:"missing_local"};
 let local;
 try{local=validateCloudProfile(JSON.parse(raw))}catch{return {status:"blocked",reason:"invalid_local"}}
 const merged=structuredClone(cloud);
 // Player-first recovery: preserve the higher observed balances and XP.
 // This is intentionally a conservative player-favourable approximation, NOT
 // a reconstructed transaction history. Keep both originals for an audit.
 const differingBalances=[];
 for(const field of ["shards","xp","skyScore"]){
  const left=Number(local[field]??0),right=Number(cloud[field]??0);
  if(!Number.isFinite(left)||!Number.isFinite(right)||left<0||right<0)
   return {status:"blocked",reason:"invalid_balance",fields:[field]};
  if(left!==right)differingBalances.push(field);
  merged[field]=Math.max(left,right);
 }
 // Daily engagement and challenge ledgers can grant rewards: never sum them
 // or claim to reconstruct their history.
 for(const field of ["daily","challenges"]){
  // Merge independent entries by stable keys, without summing currency or
  // replaying rewards. A conflicting value for the same key is not guessed.
  const join=(left,right)=>{
   if(sameCloudProfile(left,right))return {ok:true,value:structuredClone(left)};
   if(!left||!right||typeof left!=="object"||typeof right!=="object"||Array.isArray(left)!==Array.isArray(right))return {ok:false};
   if(Array.isArray(left)){
    // Arrays lack a stable event ID. Union only when one is fully contained.
    const includes=(all,part)=>part.every(x=>all.some(y=>sameCloudProfile(x,y)));
    if(includes(left,right))return {ok:true,value:structuredClone(left)};
    if(includes(right,left))return {ok:true,value:structuredClone(right)};
    return {ok:false};
   }
   const result=structuredClone(right);
   for(const [key,value] of Object.entries(left)){
    if(!Object.hasOwn(result,key)){result[key]=structuredClone(value);continue}
    const nested=join(value,result[key]);
    if(!nested.ok){
     // Known monotonic states: true means achieved/claimed, never replay a grant.
     if(typeof value==="boolean"&&typeof result[key]==="boolean"){
       result[key]=value||result[key];continue;
     }
     // Completion and progress counters can only increase. Do not apply this
     // to currencies, spending, or timestamps.
     if(/^(count|streak|progress|completed|wins|bestScore|totalDays)$/i.test(key)&&
        typeof value==="number"&&typeof result[key]==="number"&&
        Number.isFinite(value)&&Number.isFinite(result[key])){
       result[key]=Math.max(value,result[key]);continue;
     }
     return {ok:false};
    }
    result[key]=nested.value;
   }
   return {ok:true,value:result};
  };
  const result=join(local[field]??{},cloud[field]??{});
  if(!result.ok)return {status:"blocked",reason:"mutable_ledger",fields:[field]};
  merged[field]=result.value;
 }
 const safeFields=new Set(["solved","historyBackup","noHint","badges","stars","performances","canonicalQuestState","autonomousWins","legacyAdventureAccess"]);
 const autonomy=mergeAutonomousWins(local.autonomousWins,cloud.autonomousWins);
 if(!autonomy.ok)return {status:"blocked",reason:"autonomous_wins_conflict",fields:["autonomousWins"]};
 merged.autonomousWins=autonomy.value;
 const grants=mergeLegacyAdventureAccess(local.legacyAdventureAccess,cloud.legacyAdventureAccess);
 if(!grants.ok)return {status:"blocked",reason:"legacy_adventure_access_conflict",fields:["legacyAdventureAccess"]};
 if(grants.value!==undefined)merged.legacyAdventureAccess=grants.value;
 // One-way UI tutorial acknowledgements: seeing an introduction cannot be
 // undone by restoring another device. They never award currency or badges.
 const introFlags=["autonomySeen","fullBadgeIntroSeen","autoCrossUnlockSeen","speedBadgeIntroSeen"];
 for(const flag of introFlags){
  const left=local[flag],right=cloud[flag];
  if(![undefined,null,0,1,false,true].includes(left)||![undefined,null,0,1,false,true].includes(right))
   return {status:"blocked",reason:"invalid_intro_flag",fields:[flag]};
  if(Boolean(left)||Boolean(right))merged[flag]=1;
  else if(Object.hasOwn(cloud,flag))merged[flag]=cloud[flag];
  else if(Object.hasOwn(local,flag))merged[flag]=local[flag];
 }
 const unknownDifferences=[];
 for(const field of new Set([...Object.keys(cloud),...Object.keys(local)])){
  if(safeFields.has(field)||introFlags.includes(field)||["shards","xp","skyScore","daily","challenges"].includes(field))continue;
  if(!sameCloudProfile(local[field]??null,cloud[field]??null))unknownDifferences.push(field);
 }
 if(unknownDifferences.length)return {status:"blocked",reason:"unclassified_field",fields:unknownDifferences};
 // Completed quests and monotonic boolean awards may be unioned; conflicting
 // non-boolean payloads cannot be resolved without a transaction ledger.
 for(const field of ["solved","historyBackup","noHint"]){
  merged[field]=structuredClone(cloud[field]||{});
  for(const [id,value] of Object.entries(local[field]||{})){
   if(!value)continue;
   if(merged[field][id]&& !sameCloudProfile(merged[field][id],value))return {status:"blocked",reason:"achievement_conflict"};
   merged[field][id]=structuredClone(value);
  }
 }
 // Preserve earned awards, while retaining immutable per-attempt evidence.
 // Only explicitly monotonic fields can be merged. Unknown or contradictory
 // reward payloads still block rather than manufacturing achievements.
 const rewardMerge=(field,left,right)=>{
  if(sameCloudProfile(left,right))return {ok:true,value:structuredClone(right)};
  if(field==="badges"||field==="stars"){
   if((left===true||left===1)&&(right===false||right===0||right==null))return {ok:true,value:structuredClone(left)};
   if((right===true||right===1)&&(left===false||left===0||left==null))return {ok:true,value:structuredClone(right)};
  }
  if(!left||!right||typeof left!=="object"||typeof right!=="object"||Array.isArray(left)||Array.isArray(right))return {ok:false};
  const out=structuredClone(right);
  if(field==="performances"){
   const qualification=mergeQualificationMetadata(left,right);
   if(!qualification.ok)return qualification;
   Object.assign(out,qualification.value);
  }
  for(const [key,value] of Object.entries(left)){
   if(field==="performances"&&qualificationFields.includes(key))continue;
   if(!Object.hasOwn(out,key)){out[key]=structuredClone(value);continue}
   if(sameCloudProfile(value,out[key]))continue;
   if((key==="badges"||key==="awards")&&value&&out[key]&&typeof value==="object"&&typeof out[key]==="object"){
    const nested=rewardMerge("badges",value,out[key]);if(!nested.ok)return {ok:false};out[key]=nested.value;continue;
   }
   if(field==="badges"||field==="stars"){
    const nested=rewardMerge(field,value,out[key]);if(nested.ok){out[key]=nested.value;continue}
   }
   if((key==="bestTime"||key==="bestSeconds"||(field==="performances"&&key==="time"))&&typeof value==="number"&&typeof out[key]==="number"&&Number.isFinite(value)&&Number.isFinite(out[key])&&value>0&&out[key]>0){out[key]=Math.min(value,out[key]);continue}
   // Conflicting run records, canonical rewards, and other timestamps are not
   // equivalent to monotonic achievements: preserve both backups and block.
   return {ok:false,conflictKeys:[key]};
  }
  return {ok:true,value:out};
 };
 for(const field of ["badges","stars","performances","canonicalQuestState"]){
  merged[field]=structuredClone(cloud[field]||{});
  for(const [id,value] of Object.entries(local[field]||{})){
   if(!Object.hasOwn(merged[field],id)){merged[field][id]=structuredClone(value);continue}
   const result=rewardMerge(field,value,merged[field][id]);
   if(!result.ok)return {status:"blocked",reason:"reward_conflict",fields:[field],conflictId:id,conflictKeys:Array.isArray(result.conflictKeys)?result.conflictKeys.slice(0,8):[]};
   merged[field][id]=result.value;
  }
 }
 if(local.autonomousWins==null&&cloud.autonomousWins==null)delete merged.autonomousWins;
 if(sameCloudProfile(merged,cloud)){
  return {status:"cloud_dominant",profile:cloud};
 }
 await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileLocal_",raw);
 await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileRemote_",JSON.stringify(cloud));
 const updated=await compareAndSwapCloudProfile(supabase,validateCloudProfile(merged),cloud);
 const verified=await loadVerifiedProfile(supabase);
 if(!sameCloudProfile(updated,verified))throw Error("Reconciliation cloud non verifiee");
 return {status:"reconciled",profile:verified,playerFavouredBalances:differingBalances};
}
