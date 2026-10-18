import assert from "node:assert/strict";
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from "../src/persistence/canonical-outbox.js";
const values=new Map();
const storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const outbox=createCanonicalVictoryOutbox(storage);
const reward={badges:{autonomy:true},stars:1};
const first=outbox.enqueue("player-a","quest-001",reward);
assert.deepEqual(outbox.enqueue("player-a","quest-001",{stars:100}),first,"replay cannot mutate reward");
assert.equal(outbox.pending("player-b").length,0,"no cross-user outbox leakage");
assert.equal(outbox.pending("player-a").length,1);
let tries=0;
await replayCanonicalVictoryOutbox(outbox,"player-a",async()=>{tries++;throw Error("offline")});
assert.equal(tries,1);
assert.equal(outbox.pending("player-a").length,1,"failed network preserves intent");
let confirmed=false;
await replayCanonicalVictoryOutbox(outbox,"player-a",async(q)=>{confirmed=true;return {profile:{canonicalQuestState:{[q]:{solved:true,badges:{autonomy:true}}}}}});
assert.equal(confirmed,true);
assert.equal(outbox.pending("player-a").length,0,"verified server victory removes intent");
outbox.enqueue("player-a","quest-002",reward);
let calls=0;
await replayCanonicalVictoryOutbox(outbox,"player-a",async()=>{calls++;return {profile:{canonicalQuestState:{}}}});
assert.equal(calls,1);
assert.equal(outbox.pending("player-a").length,1,"unverified server result must retain intent");
outbox.enqueue("player-b","quest-002",reward);
await replayCanonicalVictoryOutbox(outbox,"player-a",async()=>{calls++;return {profile:{canonicalQuestState:{'quest-002':{solved:true}}}}},{sessionValid:()=>false});
assert.equal(outbox.pending("player-a").length,1,"session switch prevents replay");
assert.equal(outbox.pending("player-b").length,1);

// A corrupt checkpoint is a recoverable incident, never proof that no win exists.
const corruptKey="lumenCanonicalVictoryOutboxV1:player-a:quest-corrupt";
values.set(corruptKey,"{invalid json");
assert.throws(()=>outbox.pending("player-a"),/Outbox integrity check failed/);
assert.equal(values.get(corruptKey),"{invalid json","corrupt checkpoint is never destroyed");
values.delete(corruptKey);
const invalidKey="lumenCanonicalVictoryOutboxV1:player-a:quest-invalid";
values.set(invalidKey,JSON.stringify({userId:"player-b",questId:"quest-invalid",reward}));
assert.throws(()=>outbox.pending("player-a"),/Outbox integrity check failed/);
assert.ok(values.has(invalidKey),"cross-account mismatch remains available for investigation");
values.delete(invalidKey);

// Browser restart: a new outbox instance must recover unchanged durable data.
const restarted=createCanonicalVictoryOutbox(storage);
restarted.enqueue("player-a","quest-restarted",reward);
assert.deepEqual(createCanonicalVictoryOutbox(storage).pending("player-a").find(x=>x.questId==="quest-restarted")?.reward,reward);
await replayCanonicalVictoryOutbox(createCanonicalVictoryOutbox(storage),"player-a",async()=>{throw Error("still offline")});
assert.ok(createCanonicalVictoryOutbox(storage).pending("player-a").some(x=>x.questId==="quest-restarted"),"reload + offline retains intent");
// Storage quota failure must prevent a false claim of durability.
const quotaStorage={...storage,setItem(){const error=new Error("Storage full");error.name="QuotaExceededError";throw error}};
const quotaOutbox=createCanonicalVictoryOutbox(quotaStorage);
assert.throws(()=>quotaOutbox.enqueue("player-a","quest-quota",reward),/Storage full/);
assert.equal(quotaOutbox.pending("player-a").some(x=>x.questId==="quest-quota"),false,"failed local write is never acknowledged");

// A competing tab must not cause an acknowledgement to discard a different intent.
outbox.enqueue("player-a","quest-race",reward);
assert.throws(()=>outbox.acknowledge("player-a","quest-race",{stars:99}),/Outbox reward changed/);
assert.ok(outbox.pending("player-a").some(x=>x.questId==="quest-race"),"old acknowledgement never deletes a replaced reward");

// A cloud-confirmed victory must remain acknowledged even if local cleanup
// fails; a retained intent is safe to replay because server CAS is idempotent.
const failingRemove={get length(){return storage.length},key:i=>storage.key(i),getItem:k=>storage.getItem(k),setItem:(k,v)=>storage.setItem(k,v),removeItem(){throw Error("remove blocked")}};
const blocked=createCanonicalVictoryOutbox(failingRemove);
blocked.enqueue("player-a","quest-confirmed",reward);
assert.throws(()=>blocked.acknowledge("player-a","quest-confirmed"),/remove blocked/);
assert.ok(blocked.pending("player-a").some(x=>x.questId==="quest-confirmed"));

const ui=(await import("node:fs")).readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.ok(ui.includes("const recovered=await replayCanonicalVictoryOutbox(canonicalVictoryOutbox,accountId,"),"hydration replays only current player's outbox");
assert.ok(ui.includes("cloud=await loadVerifiedProfile(hydrationClient);"),"hydration refreshes verified cloud before installing");
assert.ok(ui.includes("const pending=await canonicalVictoryOutbox.enqueue(ownerId,q.id,queuedReward,{operationId});"),"victory intent persists before network with stable run identity");
assert.ok(ui.indexOf("const pending=await canonicalVictoryOutbox.enqueue(ownerId,q.id,queuedReward,{operationId});") < ui.indexOf("if(!(await confirmCloudReward()))return;",ui.indexOf("async function celebrateCanonicalSuccess()")),"persist before async cloud readiness");
assert.ok(ui.includes("try{await canonicalVictoryOutbox.acknowledge(ownerId,q.id,pending.reward,pending.operationId)}catch(error)"),"failed local cleanup does not mask confirmed cloud victory or discard another run");

assert.ok(ui.includes("locallySaved=!!lumenUser&&!!durableIntent&&(await canonicalVictoryOutbox.pending(lumenUser.id)).some(entry=>entry.operationId===durableIntent.operationId&&entry.questId===q.id)"),"pending message checks this run's durable intent, not another pending victory");
assert.ok(ui.includes("Victoire conservée sur cet appareil, en attente de synchronisation."),"saved intent has honest pending copy");
assert.ok(ui.includes("la conservation locale n'est pas confirmée"),"failed storage write never falsely claims durability");
assert.ok(ui.includes("async function retryPendingCanonicalOutboxOnReconnect()"),"recover pending wins on reconnection");
assert.ok(ui.includes("void retryPendingCanonicalOutboxOnReconnect();"),"online and PWA resume initiate retry");
assert.ok(ui.includes("canonicalOutboxRetryInFlight=true"),"replay has concurrent retry guard");
assert.ok(ui.includes("if(cloudProfileReady&&!cloudProfileDirty&&!cloudProfileBusy&&!canonicalActiveQuest)location.reload();"),"replay never reloads a divergent, active or dirty profile");
assert.ok(ui.includes("canonicalOutboxRetryInFlight||!canReplayCanonicalOutbox()"),"all replay entry points use the guarded recovery policy");
console.log("Canonical victory outbox retains failure and isolates player identities");
