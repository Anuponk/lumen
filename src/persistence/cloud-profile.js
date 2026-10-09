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

export function mergeCloudProfile(local,remote){
  const a=validateCloudProfile(local),b=validateCloudProfile(remote);
  const merged=structuredClone(a);
  // Monotonic quest markers, stars, badges, and earned rewards.
  for(const field of ["solved","historyBackup","noHint","stars","badges","performances"]){
    const left=a[field]&&typeof a[field]==="object"&&!Array.isArray(a[field])?a[field]:{};
    const right=b[field]&&typeof b[field]==="object"&&!Array.isArray(b[field])?b[field]:{};
    merged[field]={...right,...left};
    for(const [key,val] of Object.entries(right)){
      if(!(key in left)){merged[field][key]=val;continue}
      if(field==="stars"&&typeof val==="number")merged[field][key]=Math.max(Number(left[key])||0,val);
      else if(["solved","historyBackup","noHint"].includes(field))merged[field][key]=left[key]||val;
      else if(field==="badges"&&val&&typeof val==="object"&&left[key]&&typeof left[key]==="object")
        merged[field][key]={...val,...left[key]};
      // Performance runs cannot safely be combined: preserve local record, retain remote if absent.
    }
  }
  const ad=a.daily||{},bd=b.daily||{};
  merged.daily={...bd,...ad,dates:{...(bd.dates||{}),...(ad.dates||{})},rewards:{...(bd.rewards||{}),...(ad.rewards||{})}};
  for(const field of ["xp","shards","skyScore"]) if(Number.isFinite(a[field])||Number.isFinite(b[field]))
    merged[field]=Math.max(Number(a[field])||0,Number(b[field])||0);
  merged.challenges={...(b.challenges||{}),...(a.challenges||{})};
  // Preserve local-only fields, and remote-only fields that do not exist locally.
  for(const [key,val] of Object.entries(b))if(!(key in merged))merged[key]=val;
  return validateCloudProfile(merged);
}
