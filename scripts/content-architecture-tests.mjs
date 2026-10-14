import assert from "node:assert/strict";
import {astronomicalDisplayShape} from "../src/ui/astronomical-shapes.js";
import {CAMPAIGN_SIZE_SCHEDULE,CONSTELLATIONS} from "../src/campaign/data.js";
import {ADVENTURE_SIZE,CONTENT_MODEL_VERSION,BASE_SKY_ID,BASE_PACK_ID,BASE_CONSTELLATION_IDS,BASE_CONSTELLATIONS,CONTENT_SKIES,CONTENT_PACKS,CONTENT_CONSTELLATIONS,RESERVED_ADVENTURE_03_CONSTELLATIONS,baseCampaignQuestCount,baseQuestId,normalizeEntitlements,hasPackAccess,packForLegacyQuest,contentAccessForLegacyQuest,contentRegistrySnapshot,contentMapModel} from "../src/campaign/content.js";


// Astronomical drawing invariant: Orion keeps the same 17 star slots so that
// historic star-reveal state remains compatible, while its recognisable belt,
// shoulders, feet and sword use explicit, stable connections.
const orion=astronomicalDisplayShape(CONSTELLATIONS.find(c=>c.name==="Orion"));
assert(orion);
assert.equal(orion.count,17);
assert.notEqual(orion,CONSTELLATIONS.find(c=>c.name==="Orion"));
assert.equal(orion.pts.length,17);
const orionSegments=new Set(orion.edges.map(([a,b])=>[a,b].sort((x,y)=>x-y).join("-")));
for(const [a,b] of [[2,3],[3,4],[0,2],[1,4],[2,5],[4,6],[3,15],[15,16],[16,10]])
 assert(orionSegments.has([a,b].sort((x,y)=>x-y).join("-")), `Missing Orion sky figure edge ${a}-${b}`);
for(const [a,b] of orion.edges)assert(a>=0&&b>=0&&a<orion.count&&b<orion.count);

import fs from "node:fs";
const astronomicalAgentContract=fs.readFileSync(new URL("../AGENTS.md",import.meta.url),"utf8");
const astronomicalArchitecture=fs.readFileSync(new URL("../docs/DATA_AND_ARCHITECTURE.md",import.meta.url),"utf8");
const astronomicalGeneratorContract=fs.readFileSync(new URL("../docs/GENERIC_ASTRONOMY_RENDERER.md",import.meta.url),"utf8");
assert.match(astronomicalAgentContract,/Astronomical source of truth — mandatory for all new content/);
assert.match(astronomicalAgentContract,/Never invent or hand-draw star coordinates/);
assert.match(astronomicalArchitecture,/Astronomical generation contract \(non-negotiable\)/);
assert.match(astronomicalGeneratorContract,/Règle fondatrice de génération — obligatoire/);

assert.equal(CONTENT_MODEL_VERSION,1);
assert.equal(BASE_SKY_ID,"real-sky");
assert.equal(BASE_PACK_ID,"base-real-sky");
const total=Object.keys(CAMPAIGN_SIZE_SCHEDULE).length,constellations=CONSTELLATIONS.length;
assert.equal(baseCampaignQuestCount(),total);
assert.equal(BASE_CONSTELLATION_IDS.length,constellations);
assert.equal(BASE_CONSTELLATIONS.length,constellations);
assert.equal(BASE_CONSTELLATIONS[0].questStart,0);
assert.equal(BASE_CONSTELLATIONS.reduce((sum,c)=>sum+c.questCount,0),total);
assert.equal(new Set(BASE_CONSTELLATION_IDS).size,constellations);
for(let i=0;i<BASE_CONSTELLATIONS.length;i++){
 const constellation=BASE_CONSTELLATIONS[i];
 assert.equal(constellation.id,`real-${String(i+1).padStart(2,"0")}`);
 assert.equal(constellation.questCount,constellation.questIndices.length);
 assert.equal(constellation.questStart,constellation.questIndices[0]);
 assert.ok(constellation.questIndices.every(q=>Number.isInteger(q)&&q>=0&&q<total));
}
assert.equal(new Set(BASE_CONSTELLATIONS.flatMap(c=>c.questIndices)).size,total);
assert.equal(CONTENT_SKIES.length,1);
assert.equal(CONTENT_PACKS.length,Math.ceil(constellations/ADVENTURE_SIZE)+1);
assert.equal(CONTENT_PACKS[0].questCount,BASE_CONSTELLATIONS.slice(0,ADVENTURE_SIZE).reduce((sum,c)=>sum+c.questCount,0));
assert.equal(CONTENT_PACKS.reduce((sum,p)=>sum+p.questCount,0),total+100);
assert.deepEqual(CONTENT_PACKS.slice(0,-1).flatMap(p=>p.constellationIds).filter(id=>id.startsWith("real-")&&!id.includes("-new-")),BASE_CONSTELLATION_IDS);
assert.equal(RESERVED_ADVENTURE_03_CONSTELLATIONS.length,6);
assert.equal(CONTENT_PACKS[2].constellationIds.length,10);
assert.equal(new Set(CONTENT_PACKS[2].constellationIds).size,10);
assert.equal(CONTENT_CONSTELLATIONS.length,40);
for(const c of RESERVED_ADVENTURE_03_CONSTELLATIONS){
 assert.equal(c.questCount,10);
 assert.equal(c.questIndices.length,0);
 assert.equal(c.canonicalOnly,true);
 assert.equal(c.packId,"real-adventure-03");
}
for(const pack of CONTENT_PACKS){assert.equal(pack.questCount,pack.questIndices.length);assert.equal(pack.legacyQuestStart,pack.questIndices[0]);}
assert.equal(baseQuestId(0),"base-q001");
assert.equal(baseQuestId(99),"base-q100");
assert.equal(baseQuestId(100),"base-q101");
assert.equal(baseQuestId(total-1),`base-q${String(total).padStart(3,"0")}`);
assert.equal(baseQuestId(total),null);
assert.equal(packForLegacyQuest(0)?.id,BASE_PACK_ID);
assert.equal(packForLegacyQuest(99)?.id,BASE_CONSTELLATIONS.find(c=>c.questIndices.includes(99)).packId);
assert.equal(contentAccessForLegacyQuest(42,[]).accessible,true);

const futurePack={id:"extraordinary-01",skyId:"extraordinary-sky",kind:"addon",access:"entitlement",legacyQuestStart:total,questCount:24,constellationIds:["extra-01","extra-02"]};
assert.equal(hasPackAccess(futurePack,[]),false);
assert.equal(hasPackAccess(futurePack,[{pack_id:"extraordinary-01"}]),true);
assert.equal(normalizeEntitlements([{content_id:"extraordinary-01"}]).has("extraordinary-01"),true);
assert.equal(normalizeEntitlements([{entitlement:"extraordinary-01",source:"purchase"}]).has("extraordinary-01"),true);
assert.equal(packForLegacyQuest(total-1,[...CONTENT_PACKS,futurePack])?.id,CONTENT_PACKS.at(-2).id);
assert.equal(packForLegacyQuest(total+10,[...CONTENT_PACKS,futurePack])?.id,"real-adventure-04");
assert.equal(contentAccessForLegacyQuest(total+10,[{pack_id:"real-adventure-04"}],[...CONTENT_PACKS,futurePack]).accessible,true);
assert.equal(baseCampaignQuestCount(),total);
const snapshot=contentRegistrySnapshot();
assert.deepEqual(snapshot.packs.slice(0,-1).flatMap(p=>p.constellationIds).filter(id=>id.startsWith("real-")&&!id.includes("-new-")),BASE_CONSTELLATION_IDS);
console.log(JSON.stringify({contentArchitecture:true,baseQuests:baseCampaignQuestCount(),baseConstellations:BASE_CONSTELLATION_IDS.length,futurePackRepresentable:true}));

{
 const anonymous=contentMapModel([]);
 assert.equal(anonymous.skies[0].id,BASE_SKY_ID);
 assert.equal(anonymous.skies[0].packs[0].accessible,true);
 assert.equal(anonymous.skies[0].constellations.length,constellations+16);
 assert.ok(anonymous.skies[0].packs[0].constellations.every(c=>c.accessible));
 assert.ok(anonymous.skies[0].packs.slice(1).every(p=>!p.accessible));
}
