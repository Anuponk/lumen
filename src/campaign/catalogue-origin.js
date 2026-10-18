import history from '../../content/catalogue/access-origins.json' with {type:'json'};

export const currentCatalogueOrigin=history.current;
const versions=new Map(history.catalogues.map(entry=>[entry.revision,entry.quests]));
const currentPacks=new Map(versions.get(currentCatalogueOrigin).map(q=>[q.id,q.packId]));
export function cataloguePackForQuestId(id){return currentPacks.get(String(id))??null}
export function catalogueOrigin(profile={}){
 if(Object.hasOwn(profile,'catalogueOrigin')){
  if(!Number.isSafeInteger(profile.catalogueOrigin)||!versions.has(profile.catalogueOrigin))throw Error('Unsupported catalogue origin');
  return profile.catalogueOrigin;
 }
 const played=Object.values(profile.solved??{}).some(Boolean)||Object.values(profile.canonicalQuestState??{}).some(entry=>entry?.solved);
 return played?history.catalogues[0].revision:currentCatalogueOrigin;
}
export function originQuests(profile){return versions.get(catalogueOrigin(profile))}
// An older origin preserves at least as much historical access. This metadata
// never proves pack ownership and never grants completion or economic rewards.
export function mergeCatalogueOrigin(local,cloud){
 try{
  if(local.catalogueOrigin===undefined&&cloud.catalogueOrigin===undefined)return {ok:true};
  const remote=catalogueOrigin(cloud);
  if(local.catalogueOrigin!==undefined&&catalogueOrigin(local)!==remote)return {ok:false};
  return {ok:true,value:cloud.catalogueOrigin??local.catalogueOrigin};
 }catch{return {ok:false}}
}
