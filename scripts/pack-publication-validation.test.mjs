import test from "node:test";
import assert from "node:assert/strict";
import {validateStagedAdventure} from "./pack-publication-validation.mjs";
const manifest=()=>({schemaVersion:1,mode:"staging-only",pack:{id:"new-pack",skyId:"real-sky",questCount:1,questIndices:[196],constellationIds:["new-star"]},
 constellations:[{id:"new-star",packId:"new-pack",skyId:"real-sky",questIndices:[196]}],
 quests:[{id:"pack-new-pack-q001",legacyIndex:196,size:4,reg:[[0,0,1,1],[0,0,1,1],[2,2,3,3],[2,2,3,3]],sol:[0,2,1,3],audit:{ok:true,solutions:1}}],
 safety:{publishedQuestIdsPreserved:true,existingCatalogueUntouched:true}});
test("accepts append-only staged pack",()=>assert.equal(validateStagedAdventure(manifest(),{publishedQuestCount:196}).ok,true));
test("rejects index reuse and existing IDs",()=>{
 const result=validateStagedAdventure(manifest(),{publishedQuestCount:197,existingPacks:[{id:"new-pack"}]});
 assert.equal(result.ok,false);
 assert.match(result.errors.join(" "),/already exists/);
 assert.match(result.errors.join(" "),/Non-append-only/);
});
test("rejects incomplete and malformed staging",()=>{
 const m=manifest();m.quests[0].audit.solutions=2;
 assert.equal(validateStagedAdventure(m,{publishedQuestCount:196}).ok,false);
 assert.equal(validateStagedAdventure(null).ok,false);
});
