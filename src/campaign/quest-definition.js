// Published identity/order is content. Compatibility keys are opaque references;
// neither their presence nor a pack's current size determines quest placement.
export function buildQuestDefinitions(records,packs,constellations){
 const packById=new Map(packs.map(p=>[p.id,p]));
 const constellationById=new Map(constellations.map(c=>[c.id,c]));
 if(packById.size!==packs.length||constellationById.size!==constellations.length)throw Error('Duplicate content identity');
 const ids=new Set(),legacyIndices=new Set(),positions=new Map();
 return Object.freeze(records.map((record,index)=>{
  const {id,ordinal,legacyIndex,packId,constellationId}=record;
  const pack=packById.get(packId),constellation=constellationById.get(constellationId);
  if(typeof id!=='string'||!id||ids.has(id))throw Error('Duplicate or missing quest identity');
  if(ordinal!==index+1)throw Error('Noncontiguous published quest order');
  if(legacyIndex!==null&&(!Number.isSafeInteger(legacyIndex)||legacyIndex<0||legacyIndices.has(legacyIndex)))throw Error('Invalid or duplicate legacy reference');
  if(!pack||!constellation||constellation.packId!==packId||!pack.constellationIds.includes(constellationId))throw Error('Invalid quest membership: '+id);
  ids.add(id);if(legacyIndex!==null)legacyIndices.add(legacyIndex);
  const position=(positions.get(constellationId)||0)+1;positions.set(constellationId,position);
  return Object.freeze({id,ordinal,legacyIndex,packId,constellationId,position});
 }));
}
