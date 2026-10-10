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
export function cloudSafelyCoversLocal(local,remote){
  if(!local || typeof local!=="object" || Array.isArray(local))return true;
  const cloud=validateCloudProfile(remote);
  for(const field of ["shards","xp","skyScore"]){
    if(Number(local[field]||0)>Number(cloud[field]||0))return false;
  }
  for(const field of ["solved","historyBackup","badges","stars","noHint"]){
    for(const [key,value] of Object.entries(local[field]||{})){
      if(value && !cloud[field]?.[key])return false;
    }
  }
  for(const [key,perf] of Object.entries(local.performances||{})){
    const saved=cloud.performances?.[key];
    if(!saved)return false;
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
export function installCloudProfileLocally(storage,cloud){
 const verified=validateCloudProfile(cloud),key="lumenProgressV1";
 const current=storage.getItem(key);
 const json=JSON.stringify(verified);
 if(current===json)return false;
 if(current!==null){
  const backup="lumenBeforeCloudAuthority_"+Date.now();
  storage.setItem(backup,current);
  if(storage.getItem(backup)!==current)throw Error("Sauvegarde pré-migration impossible");
 }
 storage.setItem(key,json);
 if(storage.getItem(key)!==json)throw Error("Copie locale du profil cloud non vérifiée");
 return true;
}
