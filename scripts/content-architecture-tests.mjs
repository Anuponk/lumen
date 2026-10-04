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
assert.equal(BASE_CONSTELLATIONS.at(-1).questStart+BASE_CONSTELLATIONS.at(-1).questCount,total);
assert.equal(new Set(BASE_CONSTELLATION_IDS).size,constellations);
for(let i=0;i<BASE_CONSTELLATIONS.length;i++){
 assert.equal(BASE_CONSTELLATIONS[i].id,`real-${String(i+1).padStart(2,"0")}`);
 assert.equal(BASE_CONSTELLATIONS[i].questStart,i?BASE_CONSTELLATIONS[i-1].questStart+BASE_CONSTELLATIONS[i-1].questCount:0);
}
assert.equal(CONTENT_SKIES.length,1);
assert.equal(CONTENT_PACKS.length,Math.ceil(constellations/ADVENTURE_SIZE));
assert.equal(CONTENT_PACKS[0].questCount,BASE_CONSTELLATIONS.slice(0,ADVENTURE_SIZE).reduce((sum,c)=>sum+c.questCount,0));
assert.equal(CONTENT_PACKS.reduce((sum,p)=>sum+p.questCount,0),total);
assert.deepEqual(CONTENT_PACKS.flatMap(p=>p.constellationIds),BASE_CONSTELLATION_IDS);
for(let i=0;i<CONTENT_PACKS.length;i++)assert.equal(CONTENT_PACKS[i].legacyQuestStart,i?CONTENT_PACKS[i-1].legacyQuestStart+CONTENT_PACKS[i-1].questCount:0);
assert.equal(baseQuestId(0),"base-q001");
assert.equal(baseQuestId(99),"base-q100");
assert.equal(baseQuestId(100),"base-q101");
assert.equal(baseQuestId(total-1),`base-q${String(total).padStart(3,"0")}`);
assert.equal(baseQuestId(total),null);
assert.equal(packForLegacyQuest(0)?.id,BASE_PACK_ID);
assert.equal(packForLegacyQuest(99)?.id,BASE_CONSTELLATIONS.find(c=>99>=c.questStart&&99<c.questStart+c.questCount).packId);
assert.equal(contentAccessForLegacyQuest(42,[]).accessible,true);

const futurePack={id:"extraordinary-01",skyId:"extraordinary-sky",kind:"addon",access:"entitlement",legacyQuestStart:total,questCount:24,constellationIds:["extra-01","extra-02"]};
assert.equal(hasPackAccess(futurePack,[]),false);
assert.equal(hasPackAccess(futurePack,[{pack_id:"extraordinary-01"}]),true);
assert.equal(normalizeEntitlements([{content_id:"extraordinary-01"}]).has("extraordinary-01"),true);
assert.equal(normalizeEntitlements([{entitlement:"extraordinary-01",source:"purchase"}]).has("extraordinary-01"),true);
assert.equal(packForLegacyQuest(total-1,[...CONTENT_PACKS,futurePack])?.id,CONTENT_PACKS.at(-1).id);
assert.equal(packForLegacyQuest(total+10,[...CONTENT_PACKS,futurePack])?.id,"extraordinary-01");
assert.equal(contentAccessForLegacyQuest(total+10,[{pack_id:"extraordinary-01"}],[...CONTENT_PACKS,futurePack]).accessible,true);
assert.equal(baseCampaignQuestCount(),total);
const snapshot=contentRegistrySnapshot();
assert.deepEqual(snapshot.packs.flatMap(p=>p.constellationIds),BASE_CONSTELLATION_IDS);
console.log(JSON.stringify({contentArchitecture:true,baseQuests:baseCampaignQuestCount(),baseConstellations:BASE_CONSTELLATION_IDS.length,futurePackRepresentable:true}));

{
 const anonymous=contentMapModel([]);
 assert.equal(anonymous.skies[0].id,BASE_SKY_ID);
 assert.equal(anonymous.skies[0].packs[0].accessible,true);
 assert.equal(anonymous.skies[0].constellations.length,constellations);
 assert.ok(anonymous.skies[0].packs[0].constellations.every(c=>c.accessible));
 assert.ok(anonymous.skies[0].packs.slice(1).every(p=>!p.accessible));
}
