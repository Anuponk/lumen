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
