// Pure validation gate before any future catalogue publication.
// This module deliberately does not write files or mutate existing data.
export function validateStagedAdventure(staging,{existingPacks=[],existingConstellations=[],publishedQuestCount=0}={}){
 const errors=[];
 const check=(ok,message)=>{if(!ok)errors.push(message)};
 const pack=staging?.pack,cs=staging?.constellations,qs=staging?.quests;
 check(staging?.schemaVersion===1,"Unsupported staging schema");
 check(staging?.mode==="staging-only","Manifest is not a staging preview");
 check(typeof pack?.id==="string"&&pack.id.length>0,"Missing pack ID");
 check(Array.isArray(cs)&&cs.length>0,"Missing constellations");
 check(Array.isArray(qs)&&qs.length>0,"Missing quests");
 if(!pack||!Array.isArray(cs)||!Array.isArray(qs))return {ok:false,errors};
 const ids=new Set(existingPacks.map(p=>p.id));
 check(!ids.has(pack.id),"Pack ID already exists");
 const constellationIds=new Set(existingConstellations.map(c=>c.id));
 const questIds=new Set(),indices=new Set();
 for(const c of cs){
  check(typeof c.id==="string"&&!constellationIds.has(c.id),"Duplicate constellation ID: "+c.id);
  constellationIds.add(c.id);
  check(c.packId===pack.id,"Constellation pack mismatch: "+c.id);
  check(c.skyId===pack.skyId,"Constellation sky mismatch: "+c.id);
 }
 for(const [i,q] of qs.entries()){
  check(typeof q.id==="string"&&!questIds.has(q.id),"Duplicate quest ID: "+q.id);
  questIds.add(q.id);
  check(Number.isInteger(q.legacyIndex)&&q.legacyIndex===publishedQuestCount+i,"Non-append-only quest index at "+i);
  check(!indices.has(q.legacyIndex),"Duplicate quest index: "+q.legacyIndex);
  indices.add(q.legacyIndex);
  const n=q.size;
  check(Number.isInteger(n)&&n>=4&&Array.isArray(q.reg)&&q.reg.length===n&&q.reg.every(r=>Array.isArray(r)&&r.length===n),"Invalid region grid: "+q.id);
  check(Array.isArray(q.sol)&&q.sol.length===n&&q.sol.every(col=>Number.isInteger(col)&&col>=0&&col<n),"Invalid solution: "+q.id);
  check(q.audit?.ok===true&&q.audit?.solutions===1,"Missing successful uniqueness audit: "+q.id);
 }
 const expected=qs.map(q=>q.legacyIndex);
 check(JSON.stringify(pack.questIndices)===JSON.stringify(expected),"Pack quest indices differ");
 check(pack.questCount===qs.length,"Pack quest count differs");
 check(JSON.stringify(pack.constellationIds)===JSON.stringify(cs.map(c=>c.id)),"Pack constellation IDs differ");
 const assigned=cs.flatMap(c=>c.questIndices||[]);
 check(JSON.stringify(assigned)===JSON.stringify(expected),"Constellation quest assignments differ");
 check(staging.safety?.publishedQuestIdsPreserved===true&&staging.safety?.existingCatalogueUntouched===true,"Missing preservation guarantees");
 return {ok:errors.length===0,errors};
}
