import assert from "node:assert/strict";
import {CAMPAIGN_SIZE_SCHEDULE,CONSTELLATIONS} from "../src/campaign/data.js";
import {ADVENTURE_SIZE,CONTENT_MODEL_VERSION,BASE_SKY_ID,BASE_PACK_ID,BASE_CONSTELLATION_IDS,BASE_CONSTELLATIONS,CONTENT_SKIES,CONTENT_PACKS,baseCampaignQuestCount,baseQuestId,normalizeEntitlements,hasPackAccess,packForLegacyQuest,contentAccessForLegacyQuest,contentRegistrySnapshot,contentMapModel} from "../src/campaign/content.js";

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
assert.deepEqual(CONTENT_PACKS.slice(0,-1).flatMap(p=>p.constellationIds),BASE_CONSTELLATION_IDS);
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
assert.deepEqual(snapshot.packs.slice(0,-1).flatMap(p=>p.constellationIds),BASE_CONSTELLATION_IDS);
console.log(JSON.stringify({contentArchitecture:true,baseQuests:baseCampaignQuestCount(),baseConstellations:BASE_CONSTELLATION_IDS.length,futurePackRepresentable:true}));

{
 const anonymous=contentMapModel([]);
 assert.equal(anonymous.skies[0].id,BASE_SKY_ID);
 assert.equal(anonymous.skies[0].packs[0].accessible,true);
 assert.equal(anonymous.skies[0].constellations.length,constellations+10);
 assert.ok(anonymous.skies[0].packs[0].constellations.every(c=>c.accessible));
 assert.ok(anonymous.skies[0].packs.slice(1).every(p=>!p.accessible));
}
