// Explicit migration backup. Never automatically overwrites a cloud snapshot.
import {catalogueOrigin,mergeCatalogueOrigin,currentCatalogueOrigin} from '../campaign/catalogue-origin.js';
import {archiveRecoveryBackups} from './storage-maintenance.js';
import {MAX_PROFILE_BYTES,profileStorageBytes} from './profile-size.js';
import {captureGuestClaim,claimGuestProfile} from './guest-claim.js';
// Top-level profile contract. Policies describe existing recovery rules, not
// permission to award a reward or bypass a transactional server projection.
export const CLOUD_PROFILE_FIELDS=Object.freeze(Object.fromEntries(Object.entries({
 solved:["command","achievement"],historyBackup:["cache","achievement"],
 badges:["legacy","achievement"],stars:["command","achievement"],noHint:["command","achievement"],
 performances:["command","achievement"],canonicalQuestState:["ledger","achievement"],
 autonomousWins:["command","achievement"],legacyAdventureAccess:["compatibility","achievement"],
 catalogueOrigin:["server","catalogue"],legacyVictoryRevision:["server","revision"],walletRevision:["server","revision"],
 shards:["transaction","legacy_balance"],xp:["transaction","legacy_balance"],skyScore:["derived","legacy_balance"],
 daily:["server","ledger"],challenges:["command","ledger"],
 autonomySeen:["device","intro"],fullBadgeIntroSeen:["device","intro"],
 autoCrossUnlockSeen:["device","intro"],speedBadgeIntroSeen:["device","intro"],
 skyHistoryVersion:["migration","equal"]
}).map(([field,[owner,reconcile]])=>[field,Object.freeze({owner,reconcile})])));
const fieldsWithPolicy=(...policies)=>Object.keys(CLOUD_PROFILE_FIELDS).filter(field=>policies.includes(CLOUD_PROFILE_FIELDS[field].reconcile));
const introFlags=fieldsWithPolicy("intro");
const validIntroFlag=value=>[undefined,null,0,1,false,true].includes(value);

export function validateCloudProfile(profile){
  if(!profile || typeof profile!=="object" || Array.isArray(profile)) throw Error("Profil invalide");
  if(!profile.solved || typeof profile.solved!=="object" || Array.isArray(profile.solved)) throw Error("Quêtes invalides");
  if(!profile.badges || typeof profile.badges!=="object" || Array.isArray(profile.badges)) throw Error("Badges invalides");
  const json=JSON.stringify(profile);
  if(!json || profileStorageBytes(json)>MAX_PROFILE_BYTES) throw Error("Sauvegarde trop volumineuse");
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

export async function loadVerifiedProfile(supabase,{userId}={}){
  const {data,error}=await supabase.rpc("lumen_restore_profile",userId?{p_expected_user_id:userId}:undefined);
  if(error){
    const failure=Error("Impossible de restaurer le profil");
    if(typeof error.code==='string'&&/^[A-Z0-9]{5,12}$/.test(error.code))failure.code=error.code;
    throw failure;
  }
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
const performanceSummaryFields=["version","attempts","stars"];
function performanceSummaryMetadata(performance){
 return Object.fromEntries(performanceSummaryFields.filter(key=>Object.hasOwn(performance,key)).map(key=>[key,performance[key]]));
}
// savePerformance stores cumulative summaries. V2 badges are grandfathered by
// V3; upgrading this format does not re-evaluate eligibility or award anything.
// Without run IDs, max(attempts) is only a lower bound, never an exact union.
function mergePerformanceSummaryMetadata(left,right){
 const out={};
 for(const key of performanceSummaryFields){
  const values=[left,right].filter(record=>Object.hasOwn(record,key)).map(record=>record[key]);
  if(!values.length)continue;
  if(key==="version"){
   if(values.length===2&&!sameCloudProfile(values[0],values[1])){
    if(!values.every(value=>value===2||value===3))return {ok:false,conflictKeys:[key]};
    out[key]=3;
   }else out[key]=values[0];
  }else{
   if(!values.every(value=>Number.isSafeInteger(value)&&value>=0))return {ok:false,conflictKeys:[key]};
   out[key]=Math.max(...values);
  }
 }
 return {ok:true,value:out};
}
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
// Diagnostic witness only, after an actual server authority refusal. These
// names never authorize a write or infer which side earned a reward. Match the
// protected projection's cooldown exclusions; return no profile values.
function legacyAuthorityConflictDetails(proposed,cloud){
 const protectedFields=['legacyVictoryRevision','solved','stars','challenges','noHint','autonomousWins','performances'];
 const value=(profile,field)=>{
  if(!Object.hasOwn(profile,field))return field==='autonomousWins'?0:field==='solved'||field==='legacyVictoryRevision'?null:{};
  const raw=profile[field];
  if(field!=='performances'||!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  return Object.fromEntries(Object.entries(raw).map(([id,record])=>[id,
   record&&typeof record==='object'&&!Array.isArray(record)?Object.fromEntries(Object.entries(record).filter(([key])=>!qualificationFields.includes(key))):record]));
 };
 const fields=protectedFields.filter(field=>!sameCloudProfile(value(proposed,field),value(cloud,field)));
 const result={fields};
 if(fields.includes('performances')){
  const left=value(proposed,'performances'),right=value(cloud,'performances');
  if(left&&right&&typeof left==='object'&&typeof right==='object'&&!Array.isArray(left)&&!Array.isArray(right)){
   const id=[...new Set([...Object.keys(left),...Object.keys(right)])].find(key=>!sameCloudProfile(left[key],right[key]));
   // Historical numeric quest IDs are safe; never echo arbitrary property names.
   if(id!==undefined&&/^(0|[1-9][0-9]{0,15})$/.test(id)){
    result.conflictId=id;
    const known=['version','badges',...performanceSummaryFields];
    const keys=new Set([...Object.keys(left[id]||{}),...Object.keys(right[id]||{})]);
    const changed=[...keys].filter(key=>!sameCloudProfile(left[id]?.[key],right[id]?.[key]));
    result.conflictKeys=[...new Set(changed.map(key=>known.includes(key)?key:'other'))].slice(0,8);
   }
  }
 }
 return result;
}
// Revision is a server-owned command cursor, never a reward to union or max.
// An older cache may adopt the verified server cursor; a newer/invalid local
// cursor must hold recovery rather than manufacture authority on the server.
function legacyRevisionConflict(local,cloud){
 for(const profile of [local,cloud]){
  const revision=profile.legacyVictoryRevision;
  if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0))
   return {status:"blocked",reason:"invalid_legacy_revision",fields:["legacyVictoryRevision"]};
 }
 if((local.legacyVictoryRevision??0)>(cloud.legacyVictoryRevision??0))
  return {status:"blocked",reason:"stale_legacy_revision",fields:["legacyVictoryRevision"]};
 return null;
}
// Replays may add badges to the same server-committed victory. Its stars and
// original performance remain immutable; this is coverage, never a new grant.
function canonicalAchievementCovered(local,cloud){
 if(sameCloudProfile(local,cloud))return true;
 if(!local?.solved||!cloud?.solved)return false;
 const {badges:left={},...leftReward}=local,{badges:right={},...rightReward}=cloud;
 if(!sameCloudProfile(leftReward,rightReward)||!left||!right||
  typeof left!=='object'||typeof right!=='object'||Array.isArray(left)||Array.isArray(right))return false;
 const badgeKeys=['autonomy','speed','noError','mastery'];
 for(const key of new Set([...Object.keys(left),...Object.keys(right)])){
  if(!badgeKeys.includes(key)){
   if(!sameCloudProfile(left[key],right[key]))return false;
   continue;
  }
  if(![undefined,null,false,0,true,1].includes(left[key])||
   ![undefined,null,false,0,true,1].includes(right[key])||Boolean(left[key])&&!Boolean(right[key]))return false;
 }
 return true;
}
function achievementRecoveryError(code,details={}){
 return Object.assign(Error(code==='CANONICAL_REWARD_CONFLICT'?'Conflit de récompense de quête canonique':'Récupération locale non vérifiée'),{code,...details});
}
export function achievementRecoveryDiagnostic(error){
 if(error?.code==='ACHIEVEMENT_STORAGE_FAILED')return {reason:
  ['storage_quota','storage_unavailable','storage_failed'].includes(error.recoveryReason)?error.recoveryReason:'storage_failed'};
 if(error?.code==='CANONICAL_REWARD_CONFLICT')return {
  reason:'canonical_reward_conflict',fields:['canonicalQuestState'],
  conflictKeys:Array.isArray(error.conflictKeys)?[...new Set(error.conflictKeys.map(key=>
   ['solved','stars','performance','badges'].includes(key)?key:'unknown_field'))].slice(0,4):[]
 };
 if(error?.name==='QuotaExceededError'||[22,1014,'LOCAL_STORAGE_QUOTA'].includes(error?.code))return {reason:'storage_quota'};
 if(error?.name==='SecurityError')return {reason:'storage_unavailable'};
 if(error?.code==='ACHIEVEMENT_BACKUP_UNVERIFIED')return {reason:'backup_unverified'};
 if(error?.code==='ACHIEVEMENT_INSTALL_UNVERIFIED')return {reason:'local_install_unverified'};
 if(error?.code==='ACHIEVEMENT_LOCAL_INVALID')return {reason:'invalid_local_profile'};
 return {reason:'achievement_recovery_failed'};
}
// These codes describe a refusal, never permission to reconcile player facts.
export function reconciliationFailureDiagnostic(reason,fields=[]){
 if(reason==='invalid_balance'&&fields.some(field=>['xp','skyScore'].includes(field))&&!fields.includes('shards'))return {domain:'reward',reason};
 const domains={
  wallet:['invalid_wallet_revision','stale_wallet_revision','invalid_balance','mutable_balance'],
  reward:['reward_conflict','canonical_reward_conflict','achievement_conflict','mutable_ledger','legacy_command_required','invalid_legacy_revision','stale_legacy_revision','autonomous_wins_conflict','legacy_adventure_access_conflict','missing_cloud_achievements'],
  storage:['storage_quota','storage_unavailable','storage_failed','backup_unverified','local_install_unverified','invalid_local_profile','invalid_local','missing_local'],
  profile:['unclassified_field','catalogue_origin_conflict','invalid_intro_flag','cloud_local_divergence','achievement_recovery_failed']
 };
 for(const [domain,reasons] of Object.entries(domains))if(reasons.includes(reason))return {domain,reason};
 return {domain:'profile',reason:'cloud_local_divergence'};
}
export function hydrationFailureDiagnostic(error,stage){
 const detail=achievementRecoveryDiagnostic(error).reason;
 const storage=['storage_quota','storage_unavailable','storage_failed','backup_unverified','local_install_unverified'].includes(detail);
 const stages=['start','local_read','cloud_restore','cloud_initialize','guest_reconciliation','guest_changed_during_hydration','wallet_establish','wallet_pending_read','wallet_receipt_read','wallet_profile_read','wallet_cache_restore','wallet_acknowledge','canonical_start_recovery','canonical_replay','legacy_replay','daily_rpc','daily_reconcile','daily_cloud_commit','owner_backup','local_reconciliation','bidirectional_reconciliation','achievement_recovery','achievement_local_read','achievement_backup','achievement_install','achievement_rollback','local_install','mirror_readback'];
 const knownStage=stages.includes(error?.stage)?error.stage:stages.includes(stage)?stage:'start';
 return {stage:knownStage,domain:storage?'storage':detail==='canonical_reward_conflict'?'reward':'cloud',detail,
  errorCode:['28000','42501','PGRST301','PGRST302','LOCAL_STORAGE_QUOTA','CANONICAL_REWARD_CONFLICT','ACHIEVEMENT_STORAGE_FAILED','ACHIEVEMENT_BACKUP_UNVERIFIED','ACHIEVEMENT_INSTALL_UNVERIFIED','ACHIEVEMENT_LOCAL_INVALID'].includes(error?.code)?error.code:'unknown',
  errorName:['Error','TypeError','SyntaxError','QuotaExceededError','SecurityError','AbortError'].includes(error?.name)?error.name:'Error'};
}
function achievementStorageStep(stage,action){
 try{return action()}catch(error){
  const reason=achievementRecoveryDiagnostic(error).reason;
  throw achievementRecoveryError('ACHIEVEMENT_STORAGE_FAILED',{
   stage,recoveryReason:['storage_quota','storage_unavailable'].includes(reason)?reason:'storage_failed'
  });
 }
}
function walletConflict(local,cloud){
 for(const profile of [local,cloud]){
  const revision=profile.walletRevision;
  if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))
   return {status:'blocked',reason:'invalid_wallet_revision',fields:['walletRevision']};
 }
 if((local.walletRevision??0)>(cloud.walletRevision??0))
  return {status:'blocked',reason:'stale_wallet_revision',fields:['walletRevision']};
 const left=Number(local.shards??0),right=Number(cloud.shards??0);
 if(!Number.isSafeInteger(left)||!Number.isSafeInteger(right)||left<0||right<0)
  return {status:'blocked',reason:'invalid_balance',fields:['shards']};
 if(!Object.hasOwn(local,'shards'))return null;
 // A lower balance is legitimate after a receipted debit. Without a cursor on
 // both copies, neither a grant nor a spend can be reconstructed from scalars.
 if(left!==right&&!(local.walletRevision&&cloud.walletRevision>local.walletRevision))
  return {status:'blocked',reason:'mutable_balance',fields:['shards']};
 return null;
}
// Read-only coverage of server-protected V2 quest summaries. Never synthesize a
// run or merge first-completion/unknown evidence; only adopt a newer verified
// server projection which already contains every locally acknowledged fact.
function canonicalQuestCovered(local,remote){
 if(sameCloudProfile(local,remote))return true;
 const run=remote?.runPerformance;
 if(!local?.solved||!remote?.solved||run?.version!==3)return false;
 const immutable=entry=>Object.fromEntries(Object.entries(entry).filter(([key])=>!['badges','runPerformance'].includes(key)));
 if(!sameCloudProfile(immutable(local),immutable(remote)))return false;
 const badgesCovered=(left,right)=>canonicalAchievementCovered({solved:true,badges:left},{solved:true,badges:right});
 if(!badgesCovered(local.badges||{},remote.badges||{})||!badgesCovered(run.badges||{},remote.badges||{}))return false;
 const old=local.runPerformance;
 if(!old)return true;
 if(old.version!==3)return false;
 const summary=mergePerformanceSummaryMetadata(old,run),qualification=mergeQualificationMetadata(old,run);
 if(!summary.ok||!sameCloudProfile(summary.value,performanceSummaryMetadata(run))||!qualification.ok||!sameCloudProfile(qualification.value,qualificationMetadata(run)))return false;
 if(!badgesCovered(old.badges||{},run.badges||{}))return false;
 for(const [key,value] of Object.entries(old)){
  if(['badges',...performanceSummaryFields,...qualificationFields].includes(key))continue;
  if(key==='bestTime'||key==='time'){
   if(!Number.isFinite(value)||value<0||!Number.isFinite(run[key])||run[key]<0||run[key]>value)return false;
  }else if(!sameCloudProfile(value,run[key]))return false;
 }
 return true;
}
export function cloudSafelyCoversLocal(local,remote){
  if(!local || typeof local!=="object" || Array.isArray(local))return true;
  const cloud=validateCloudProfile(remote);
  if(!mergeCatalogueOrigin(local,cloud).ok)return false;
  if(legacyRevisionConflict(local,cloud)||walletConflict(local,cloud))return false;
  // Coverage is an installation boundary too: it must not silently drop local
  // fields that the reconciler would hold for explicit review.
  for(const field of Object.keys(local)){
    const policy=Object.hasOwn(CLOUD_PROFILE_FIELDS,field)?CLOUD_PROFILE_FIELDS[field].reconcile:null;
    if((policy===null||policy==="equal")&&!sameCloudProfile(local[field]??null,cloud[field]??null))return false;
  }
  for(const flag of introFlags){
    if(!validIntroFlag(local[flag])||!validIntroFlag(cloud[flag]))return false;
    if(Boolean(local[flag])&&!Boolean(cloud[flag]))return false;
  }
  const grants=mergeLegacyAdventureAccess(local.legacyAdventureAccess,cloud.legacyAdventureAccess);
  if(!grants.ok||grants.value?.some(id=>!cloud.legacyAdventureAccess?.includes(id)))return false;
  const autonomy=mergeAutonomousWins(local.autonomousWins,cloud.autonomousWins);
  if(!autonomy.ok||!sameCloudProfile(autonomy.value,cloud.autonomousWins??{}))return false;
  for(const field of ["shards","xp","skyScore"]){
    if(field==='shards')continue;
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
    if(!saved?.solved||!(canonicalAchievementCovered(entry,saved)||cloud.legacyVictoryRevision>0&&canonicalQuestCovered(entry,saved)))return false;
  }
  for(const [key,perf] of Object.entries(local.performances||{})){
    const saved=cloud.performances?.[key];
    if(!saved)return false;
    const summary=mergePerformanceSummaryMetadata(perf,saved);
    if(!summary.ok||!sameCloudProfile(summary.value,performanceSummaryMetadata(saved)))return false;
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
    // Verified command profiles may add server-owned daily/challenge receipts.
    // A superset covers old facts; conflicting/missing amounts still refuse.
    const covers=(a,b)=>a&&typeof a==='object'&&!Array.isArray(a)?b&&typeof b==='object'&&!Array.isArray(b)&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&covers(v,b[k])):sameCloudProfile(a,b);
    if(current && Object.keys(current).length && !((cloud.legacyVictoryRevision>0||cloud.walletRevision>0)?covers(current,cloud[field]||{}):sameCloudProfile(current,cloud[field]||{})))return false;
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
function cloudAchievementRecoveryPlan(storage,remote){
  const cloud=validateCloudProfile(remote);
  const key="lumenProgressV1";
  const raw=achievementStorageStep('achievement_local_read',()=>storage.getItem(key));
  if(raw===null)return {empty:cloud};
  let local;
  try{local=JSON.parse(raw)}catch{throw achievementRecoveryError('ACHIEVEMENT_LOCAL_INVALID')}
  if(!local||typeof local!=="object"||Array.isArray(local))throw achievementRecoveryError('ACHIEVEMENT_LOCAL_INVALID');
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
      if(!(canonicalAchievementCovered(localCanonical[id],entry)||cloud.legacyVictoryRevision>0&&canonicalQuestCovered(localCanonical[id],entry)))throw achievementRecoveryError('CANONICAL_REWARD_CONFLICT',{
       conflictId:id,conflictKeys:[...new Set([...Object.keys(localCanonical[id]),...Object.keys(entry)])]
        .filter(key=>!sameCloudProfile(localCanonical[id][key],entry[key]))
      });
      if(!sameCloudProfile(localCanonical[id],entry)){localCanonical[id]=structuredClone(entry);changed=true;}
    }else{
      localCanonical[id]=structuredClone(entry);changed=true;
    }
  }
  if(Object.keys(localCanonical).length)merged.canonicalQuestState=localCanonical;
  if(!changed)return {changed:false,currencyConflict:Number(local.shards)!==Number(cloud.shards)};
  return {changed:true,raw,payload:JSON.stringify(merged),currencyConflict:Number(local.shards)!==Number(cloud.shards)};
}
function installCloudAchievements(storage,plan,backupKey){
  const key="lumenProgressV1",{raw,payload,currencyConflict}=plan;
  achievementStorageStep('achievement_install',()=>storage.setItem(key,payload));
  if(achievementStorageStep('achievement_install',()=>storage.getItem(key))!==payload){
    achievementStorageStep('achievement_rollback',()=>storage.setItem(key,raw));
    throw achievementRecoveryError('ACHIEVEMENT_INSTALL_UNVERIFIED',{stage:'achievement_install'});
  }
  return {changed:true,backupKey,currencyConflict};
}
export function reconcileCloudAchievements(storage,remote){
  const plan=cloudAchievementRecoveryPlan(storage,remote);
  if(plan.empty)return restoreIntoEmptyGuestStorage(storage,plan.empty);
  if(!plan.changed)return plan;
  const {raw}=plan;
  const backupKey="lumenBeforeCloudReconcile_"+Date.now();
  achievementStorageStep('achievement_backup',()=>storage.setItem(backupKey,raw));
  if(achievementStorageStep('achievement_backup',()=>storage.getItem(backupKey))!==raw)throw achievementRecoveryError('ACHIEVEMENT_BACKUP_UNVERIFIED',{stage:'achievement_backup'});
  return installCloudAchievements(storage,plan,backupKey);
}
// The recovery copy can exceed localStorage's remaining space even when the
// updated profile fits. Preserve and read back the original in the existing
// IndexedDB recovery store before installing the same monotonic projection.
export async function reconcileCloudAchievementsDurably(storage,remote,{sessionValid=()=>true}={}){
  if(!sessionValid())return {changed:false,interrupted:true};
  const owner=achievementStorageStep('achievement_local_read',()=>storage.getItem('lumenCloudOwnerId'));
  const unchangedOwner=()=>sessionValid()&&achievementStorageStep('achievement_local_read',()=>storage.getItem('lumenCloudOwnerId'))===owner;
  const plan=cloudAchievementRecoveryPlan(storage,remote);
  if(plan.empty)return restoreIntoEmptyGuestStorage(storage,plan.empty);
  if(!plan.changed)return plan;
  let backupKey;
  try{backupKey=await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcile_",plan.raw)}
  catch(error){
    if(!unchangedOwner())return {changed:false,interrupted:true};
    if(error?.code==='RECOVERY_BACKUP_UNVERIFIED')throw achievementRecoveryError('ACHIEVEMENT_BACKUP_UNVERIFIED',{stage:'achievement_backup'});
    if(error?.code==='RECOVERY_STORAGE_UNAVAILABLE')throw achievementRecoveryError('ACHIEVEMENT_STORAGE_FAILED',{stage:'achievement_backup',recoveryReason:'storage_quota'});
    const reason=achievementRecoveryDiagnostic(error).reason;
    throw achievementRecoveryError('ACHIEVEMENT_STORAGE_FAILED',{stage:'achievement_backup',recoveryReason:['storage_quota','storage_unavailable'].includes(reason)?reason:'storage_failed'});
  }
  if(!unchangedOwner()||achievementStorageStep('achievement_local_read',()=>storage.getItem("lumenProgressV1"))!==plan.raw)return {changed:false,interrupted:true};
  try{return installCloudAchievements(storage,plan,backupKey)}
  catch(error){
    if(achievementRecoveryDiagnostic(error).reason!=='storage_quota')throw error;
    // A larger recovered cache can fail even after its original was preserved.
    // Move only eligible old copies, with the same committed/read-back archival
    // policy as account maintenance. Never purge evidence or touch the outbox.
    const unchanged=()=>unchangedOwner()&&storage.getItem('lumenProgressV1')===plan.raw;
    if(!unchanged())return {changed:false,interrupted:true};
    const archived=await archiveRecoveryBackups(storage,{sessionValid:unchanged});
    if(!unchanged()||archived.interrupted)return {changed:false,interrupted:true};
    if(!archived.archived||archived.failed)throw error;
    return installCloudAchievements(storage,plan,backupKey);
  }
}

export async function initializeCloudProfile(supabase,localProfile,{userId,guestSource,sessionValid=()=>true}={}){
 const proposed=validateCloudProfile(localProfile);
 if(!sessionValid())throw Error('Initialisation suspendue : session modifiée');
 if(guestSource){
  const manifest=await captureGuestClaim(guestSource.storage,{userId,profile:proposed,original:guestSource.original,sessionValid});
  if(!sessionValid())throw Error('Initialisation suspendue : session modifiée');
  const version=await supabase.rpc('lumen_guest_claim_version');
  if(!sessionValid())throw Error('Initialisation suspendue : session modifiée');
  if(!version.error&&version.data===1){
   return (await claimGuestProfile(supabase,manifest,{sessionValid,covers:cloudSafelyCoversLocal,loadProfile:id=>loadVerifiedProfile(supabase,{userId:id})})).profile;
  }
  // Missing capability is known before emission. Never fall back after an
  // ambiguous claim result, timeout, permission error or unknown protocol.
  const compatible=(!version.error&&version.data===0)||(version.error?.code==='PGRST202'&&version.status===404);
  if(!compatible)throw Error('Protocole de revendication indisponible');
 }
 const {data,error}=await supabase.rpc("lumen_initialize_profile",{p_payload:proposed,...(userId?{p_expected_user_id:userId}:{})});
 if(!sessionValid())throw Error('Initialisation suspendue : session modifiée');
 if(error){
  const failure=Error("Initialisation cloud impossible : refus du serveur");
  if(typeof error.code==='string'&&/^[A-Z0-9]{5,12}$/.test(error.code))failure.code=error.code;
  throw failure;
 }
 const saved=validateCloudProfile(data);
 const verified=await loadVerifiedProfile(supabase,{userId});
 if(!sessionValid())throw Error('Initialisation suspendue : session modifiée');
 if(!sameCloudProfile(saved,verified))throw Error("Profil cloud initial non vérifié");
 return saved;
}
export async function compareAndSwapCloudProfile(supabase,profile,expected,{userId}={}){
 const next=validateCloudProfile(profile),baseline=validateCloudProfile(expected);
 if(next.catalogueOrigin===undefined&&baseline.catalogueOrigin===undefined&&catalogueOrigin(baseline)===currentCatalogueOrigin)next.catalogueOrigin=currentCatalogueOrigin;
 const {data,error}=await supabase.rpc("lumen_cas_profile",{p_expected:baseline,p_payload:next,...(userId?{p_expected_user_id:userId}:{})});
 if(error){
  // Only fixed guard categories and bounded provider codes reach diagnostics.
  // Do not retain provider messages, details, hints or an unsanitized cause.
  const reasons=new Map([
   ["legacy victory command required; preserve pending data and update client","LEGACY_COMMAND_REQUIRED"],
   ["quest command required; preserve pending data","QUEST_COMMAND_REQUIRED"],
   ["quest run authority missing","QUEST_RUN_AUTHORITY_MISSING"],
   ["wallet command required; preserve pending data and update client","WALLET_COMMAND_REQUIRED"],
   ["earned XP cannot decrease","LEGACY_XP_REGRESSION"],
   ["canonical acquisition removal rejected","CANONICAL_ACQUISITION_REMOVAL"],
   ["canonical badge removal rejected","CANONICAL_BADGE_REMOVAL"],
   ["invalid canonical snapshot","INVALID_CANONICAL_SNAPSHOT"],
   ["Catalogue origin cannot be erased or rewritten","CATALOGUE_ORIGIN_REWRITE"],
   ["Catalogue origin disagrees with existing cohort","CATALOGUE_ORIGIN_CONFLICT"],
   ["Unsupported catalogue origin","UNSUPPORTED_CATALOGUE_ORIGIN"]
  ]);
  const failure=Error("Sauvegarde cloud impossible : refus du serveur");
  const providerCode=typeof error.code==="string"&&/^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code)?error.code:"CLOUD_WRITE_REFUSED";
  failure.code=reasons.get(error.message)||providerCode;
  throw failure;
 }
 if(data!==true){
  const conflict=Error("Conflit de version cloud : sauvegarde refusée");
  conflict.code="CLOUD_CAS_CONFLICT";throw conflict;
 }
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
 const base=prefix+Date.now();let key=base,collision=0;
 while(storage.getItem(key)!==null){
  if(storage.getItem(key)===value)return key;
  key=base+'_'+(++collision);
 }
 try{
  storage.setItem(key,value);
  if(storage.getItem(key)!==value)throw Object.assign(Error("Recovery snapshot verification failed"),{code:'RECOVERY_BACKUP_UNVERIFIED'});
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
export async function preserveRecoverySnapshot(storage,prefix,value){
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
   if(saved!==value)throw Object.assign(Error("IndexedDB recovery verification mismatch"),{code:'RECOVERY_BACKUP_UNVERIFIED'});
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

// Quarantine only the exact cooldown-only record produced by older canonical
// starts under the dormant numeric index. Never discard rewards/unknown data.
export async function archiveCanonicalStartMetadata(storage,remote,{quest,attempt,legacyIndex,ownerId,accountId,sessionValid=()=>true}={}){
 if(!sessionValid()||!ownerId||ownerId!==accountId||!quest||quest.legacyIndex!==null||quest.id!==attempt?.questId||!attempt.attemptId||
  !['campaign','replay'].includes(attempt.mode)||!['RUNNING','PAUSED'].includes(attempt.state)||!Number.isFinite(attempt.startedAt)||attempt.startedAt<=0||
  !Array.isArray(attempt.board)||attempt.board.length!==quest.reg?.length||
  !attempt.board.every(row=>Array.isArray(row)&&row.length===quest.reg.length&&row.every(cell=>[0,1,2].includes(cell)))||
  !Number.isSafeInteger(legacyIndex)||legacyIndex<0)return {changed:false};
 const cloud=validateCloudProfile(remote),raw=storage.getItem('lumenProgressV1');
 if(!raw)return {changed:false};
 const local=validateCloudProfile(JSON.parse(raw)),key=String(legacyIndex),record=local.performances?.[key];
 if(!record||typeof record!=='object'||Array.isArray(record)||record.questIndex!==legacyIndex||
  Object.keys(record).some(k=>!['questIndex',...qualificationFields].includes(k))||
  typeof record.lastQualifiedAt!=='string'||typeof record.lastQualifiedDay!=='string'||!mergeQualificationMetadata(record,record).ok||
  Object.hasOwn(cloud.performances||{},key))return {changed:false};
 await preserveRecoverySnapshot(storage,'lumenBeforeCanonicalStartMetadataLocal_',raw);
 await preserveRecoverySnapshot(storage,'lumenBeforeCanonicalStartMetadataRemote_',JSON.stringify(cloud));
 if(!sessionValid()||storage.getItem('lumenProgressV1')!==raw)return {changed:false};
 delete local.performances[key];
 const clean=JSON.stringify(local);storage.setItem('lumenProgressV1',clean);
 if(storage.getItem('lumenProgressV1')!==clean)throw Error('Canonical start metadata recovery not verified');
 return {changed:true};
}
/**
 * Reconcile only when the local snapshot contains every remote achievement and
 * immutable/mutable ledgers are identical. Never infer shard/XP transactions.
 * Preserve verified copies of BOTH sides before any server write.
 */
export async function reconcileDominantLocalProfile(supabase,storage,remote,{userId}={}){
 const cloud=validateCloudProfile(remote),raw=storage.getItem("lumenProgressV1");
 if(!raw)return {status:"blocked",reason:"missing_local"};
 let local;
 try{local=validateCloudProfile(JSON.parse(raw))}catch{return {status:"blocked",reason:"invalid_local"}}
 const revisionConflict=legacyRevisionConflict(local,cloud);
 if(revisionConflict)return revisionConflict;
 if(Number(local.shards??0)!==Number(cloud.shards??0))return {status:'blocked',reason:'mutable_balance'};
 const origin=mergeCatalogueOrigin(local,cloud);
 if(!origin.ok)return {status:'blocked',reason:'catalogue_origin_conflict',fields:['catalogueOrigin']};
 if(origin.value!==undefined)local.catalogueOrigin=origin.value;
 // Metadata differences need the same compatible policy as achievements.
 // Route before unknown-field checks; never upload a lower tutorial state.
 if(introFlags.some(flag=>!sameCloudProfile(local[flag]??null,cloud[flag]??null))||!sameCloudProfile(local.legacyVictoryRevision,cloud.legacyVictoryRevision)||!cloudSafelyCoversLocal(cloud,local))return {status:"blocked",reason:"missing_cloud_achievements"};
 for(const field of ["shards","xp","skyScore"]){
  if(Number(local[field]||0)!==Number(cloud[field]||0))return {status:"blocked",reason:"mutable_balance"};
 }
 for(const field of ["daily","challenges"]){
  if(!sameCloudProfile(local[field]||{},cloud[field]||{}))return {status:"blocked",reason:"mutable_ledger"};
 }
 // Unknown fields can contain non-repeatable transactions. Require equality
 // instead of silently selecting one profile's value.
 const monotonic=new Set(fieldsWithPolicy("achievement","catalogue"));
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
 let written;
 try{written=await compareAndSwapCloudProfile(supabase,local,cloud,{userId})}catch(error){
  // A verified snapshot exists and both originals have been preserved. This
  // authority refusal holds reconciliation, not independent command recovery.
  if(error.code==='LEGACY_COMMAND_REQUIRED')return {status:'blocked',reason:'legacy_command_required',...legacyAuthorityConflictDetails(local,cloud)};
  throw error;
 }
 const verified=await loadVerifiedProfile(supabase,{userId});
 if(!sameCloudProfile(verified,written))throw Error("Reconciliation cloud non verifiee");
 return {status:"reconciled",profile:verified};
}

/** Conservative two-way reconciliation. Uncertain rewards are never inferred. */
export async function reconcileCompatibleCloudProfiles(supabase,storage,remote,{userId}={}){
 const cloud=validateCloudProfile(remote),raw=storage.getItem("lumenProgressV1");
 if(!raw)return {status:"blocked",reason:"missing_local"};
 let local;
 try{local=validateCloudProfile(JSON.parse(raw))}catch{return {status:"blocked",reason:"invalid_local"}}
 const revisionConflict=legacyRevisionConflict(local,cloud);
 if(revisionConflict)return revisionConflict;
 const walletHold=walletConflict(local,cloud);
 if(walletHold){
  await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileLocal_",raw);
  await preserveRecoverySnapshot(storage,"lumenBeforeCloudReconcileRemote_",JSON.stringify(cloud));
  return walletHold;
 }
 const merged=structuredClone(cloud);
 // Spendable currency follows the verified wallet cursor, never numeric max.
 // XP and derived score keep their existing cumulative compatibility policy.
 const differingBalances=[];
 for(const field of ["shards","xp","skyScore"]){
  const left=Number(local[field]??0),right=Number(cloud[field]??0);
  if(!Number.isFinite(left)||!Number.isFinite(right)||left<0||right<0)
   return {status:"blocked",reason:"invalid_balance",fields:[field]};
  if(left!==right)differingBalances.push(field);
   merged[field]=field==='shards'?right:Math.max(left,right);
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
 const origin=mergeCatalogueOrigin(local,cloud);
 if(!origin.ok)return {status:'blocked',reason:'catalogue_origin_conflict',fields:['catalogueOrigin']};
 if(origin.value!==undefined)merged.catalogueOrigin=origin.value;
 const safeFields=new Set(fieldsWithPolicy("achievement","catalogue"));
 const autonomy=mergeAutonomousWins(local.autonomousWins,cloud.autonomousWins);
 if(!autonomy.ok)return {status:"blocked",reason:"autonomous_wins_conflict",fields:["autonomousWins"]};
 merged.autonomousWins=autonomy.value;
 const grants=mergeLegacyAdventureAccess(local.legacyAdventureAccess,cloud.legacyAdventureAccess);
 if(!grants.ok)return {status:"blocked",reason:"legacy_adventure_access_conflict",fields:["legacyAdventureAccess"]};
 if(grants.value!==undefined)merged.legacyAdventureAccess=grants.value;
 // One-way UI tutorial acknowledgements: seeing an introduction cannot be
 // undone by restoring another device. They never award currency or badges.
 // introFlags comes from the shared top-level contract.
 for(const flag of introFlags){
  const left=local[flag],right=cloud[flag];
  if(!validIntroFlag(left)||!validIntroFlag(right))
   return {status:"blocked",reason:"invalid_intro_flag",fields:[flag]};
  if(Boolean(left)||Boolean(right))merged[flag]=1;
  else if(Object.hasOwn(cloud,flag))merged[flag]=cloud[flag];
  else if(Object.hasOwn(local,flag))merged[flag]=local[flag];
 }
 const unknownDifferences=[];
 for(const field of new Set([...Object.keys(cloud),...Object.keys(local)])){
  // merged starts from cloud: keep its exact verified cursor, including absence.
   if(field==="legacyVictoryRevision"||field==="walletRevision"||safeFields.has(field)||introFlags.includes(field)||["shards","xp","skyScore","daily","challenges"].includes(field))continue;
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
   const summary=mergePerformanceSummaryMetadata(left,right);
   if(!summary.ok)return summary;
   Object.assign(out,summary.value);
   const qualification=mergeQualificationMetadata(left,right);
   if(!qualification.ok)return qualification;
   Object.assign(out,qualification.value);
  }
  for(const [key,value] of Object.entries(left)){
   if(field==="performances"&&(qualificationFields.includes(key)||performanceSummaryFields.includes(key)))continue;
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
   if(field==='canonicalQuestState'&&cloud.legacyVictoryRevision>0&&canonicalQuestCovered(value,merged[field][id]))continue;
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
 let updated;
 try{updated=await compareAndSwapCloudProfile(supabase,validateCloudProfile(merged),cloud,{userId})}catch(error){
  if(error.code==='LEGACY_COMMAND_REQUIRED')return {status:'blocked',reason:'legacy_command_required',...legacyAuthorityConflictDetails(merged,cloud)};
  throw error;
 }
 const verified=await loadVerifiedProfile(supabase,{userId});
 if(!sameCloudProfile(updated,verified))throw Error("Reconciliation cloud non verifiee");
 return {status:"reconciled",profile:verified,playerFavouredBalances:differingBalances};
}

// Explicit product policy: recover positive acquisitions, never infer a money
// transaction from a historical snapshot. The server owns the merge and keeps
// its Wallet/daily/receipt authorities. Preserve the exact device bytes first.
// This path is separate from conservative coverage: its verified result is the
// authority for retiring an ambiguous cache, whose original remains exportable.
export async function reconcilePlayerAcquisitions(supabase,storage,remote,{userId,sessionValid=()=>true}={}){
 const raw=storage.getItem('lumenProgressV1');
 if(!raw||!userId)return {status:'blocked',reason:'missing_local'};
 let local;
 try{local=validateCloudProfile(JSON.parse(raw))}catch{return {status:'blocked',reason:'invalid_local'}}
 const current=()=>sessionValid()&&storage.getItem('lumenProgressV1')===raw;
 if(!current())return {interrupted:true};
 await preserveRecoverySnapshot(storage,'lumenBeforeCloudReconcileLocal_',raw);
 if(!current())return {interrupted:true};
 let expected=validateCloudProfile(remote);
 for(let attempt=0;attempt<2;attempt++){
  await preserveRecoverySnapshot(storage,'lumenBeforeCloudReconcileRemote_',JSON.stringify(expected));
  if(!current())return {interrupted:true};
  const {data,error}=await supabase.rpc('lumen_reconcile_acquisitions',{
   p_expected_user_id:userId,p_expected:expected,p_local:local
  });
  if(!current())return {interrupted:true};
  if(error){
   if(error.code==='PGRST202')return {status:'blocked',reason:'legacy_command_required'};
   const failure=Error('Acquisition recovery refused');failure.code=error.code;throw failure;
  }
  if(data===null){
   expected=await loadVerifiedProfile(supabase,{userId});
   if(!current())return {interrupted:true};
   if(!expected)throw Error('Acquisition recovery profile missing');
   continue;
  }
  if(data?.policy!=='positive-acquisitions-v1'||data.userId!==userId)throw Error('Acquisition recovery proof invalid');
  const profile=validateCloudProfile(data.profile);
  const verified=await loadVerifiedProfile(supabase,{userId});
  if(!current())return {interrupted:true};
  if(!sameCloudProfile(profile,verified))throw Error('Acquisition recovery readback mismatch');
  // Both copies are durable, the server transaction is re-read, and the owner
  // and latest local bytes still match. No outbox entry is acknowledged here.
  const json=JSON.stringify(verified);
  try{
   storage.setItem('lumenProgressV1',json);
   if(storage.getItem('lumenProgressV1')!==json)throw Error('Acquisition cache verification failed');
  }catch(error){
   // A verified server result can run in memory if cache quota is exhausted.
   if(!['QuotaExceededError'].includes(error?.name)&&![22,1014,'LOCAL_STORAGE_QUOTA'].includes(error?.code))throw error;
   return {status:'reconciled',reason:'positive_acquisitions',profile:verified,memoryOnly:true};
  }
  return {status:'reconciled',reason:'positive_acquisitions',profile:verified};
 }
 return {status:'blocked',reason:'cloud_local_divergence'};
}
