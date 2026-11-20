import assert from "node:assert/strict";
import {createAttemptEngine,ATTEMPT_STATES,attemptOperationId} from "../src/game/attempt-engine.js";

function harness(){
 const data=new Map();let wall=1_000_000,mono=10_000;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const make=()=>createAttemptEngine({storage,now:()=>wall,perfNow:()=>mono});
 return {storage,make,tick(ms){wall+=ms;mono+=ms}};
}
{
 const h=harness(),engine=h.make();
 const ready=engine.create({questId:'review-quest',board:[[0]],persistBeforeStart:false});
 engine.requalify(true);
 assert.equal(h.storage.getItem(engine.storageKey),null,'An idle review selection never becomes a restored board');
 engine.start();
 const resumed=h.make().restore({questId:'review-quest'});
 assert.equal(attemptOperationId(resumed),attemptOperationId(ready));
 assert.equal(resumed.qualifying,true);
 assert.equal(resumed.state,ATTEMPT_STATES.PAUSED);
}
{
 const h=harness(),e=h.make(),a=e.create({questId:27,mode:"campaign",board:[[0,0],[0,0]]});
 assert.equal(a.state,ATTEMPT_STATES.READY);h.tick(5000);assert.equal(e.activeMs(),0);
 const id=a.attemptId;e.start();h.tick(1250);assert.equal(e.activeMs(),1250);
 e.pause();h.tick(9000);assert.equal(e.activeMs(),1250);assert.equal(e.snapshot().attemptId,id);
 e.resume();h.tick(750);assert.equal(e.activeMs(),2000);
 e.markAssistance();e.setWrongGuardianPending("0,0");e.commitMistake();
 const before=attemptOperationId(e.snapshot());
 e.reset([[0,0],[0,0]]);
 // #851 / #36: a grid reset only clears placements; the run continues.
 assert.equal(e.snapshot().attemptId,id);assert.equal(e.snapshot().resetCount,1);assert.equal(e.activeMs(),2000,'Elapsed time is kept');
 assert.equal(e.snapshot().assistanceUsed,true,'Assistance is kept');assert.equal(e.snapshot().mistakeCommitted,true,'Committed errors are kept');
 assert.equal(e.snapshot().wrongGuardianPending,null);assert.deepEqual(e.snapshot().board,[[0,0],[0,0]]);
 assert.equal(attemptOperationId(e.snapshot()),before,'Victory receipt and ranking keep the same run identity');
 e.reset([[0,0],[0,0]]);h.tick(500);assert.equal(e.activeMs(),2500,'Several resets never restart the clock');
 assert.equal(attemptOperationId(e.snapshot()),before);
}
// #851 compatibility: an attempt persisted by an older release keeps the run
// identity it may already have begun on the server.
{
 const h=harness(),e=h.make();e.create({questId:12,mode:"campaign",board:[[0]]});e.start();
 const saved=JSON.parse(h.storage.getItem('lumenActiveAttemptV1'));delete saved.runSegment;saved.resetCount=2;h.storage.setItem('lumenActiveAttemptV1',JSON.stringify(saved));
 const restored=h.make();const r=restored.restore({questId:12,mode:"campaign"});
 assert.equal(r.runSegment,2);assert.equal(attemptOperationId(r),r.attemptId+'-reset-2');
 assert.equal(attemptOperationId(restored.reset([[0]])),r.attemptId+'-reset-2');
 const c=h.make();c.create({questId:13,mode:"challenge",challengeId:"c2",board:[[0]]});c.reset([[0]]);
 assert.equal(attemptOperationId(c.snapshot()),c.snapshot().attemptId+'-reset-1','Challenges keep their historical identity');
}
{
 const h=harness(),e=h.make();e.create({questId:4,mode:"replay",qualifying:true,board:[[1]]});e.start();h.tick(3333);e.updateBoard([[2]]);
 const id=e.snapshot().attemptId;
 const restored=h.make().restore({questId:4,mode:"replay"});
 assert.equal(restored.attemptId,id);assert.equal(restored.state,ATTEMPT_STATES.PAUSED);assert.deepEqual(restored.board,[[2]]);assert.equal(restored.activeDuration,3333);
 h.tick(10000);assert.equal(h.make().restore({questId:4,mode:"replay"}).activeDuration,3333);
}
{
 const h=harness(),e=h.make();e.create({questId:9,mode:"challenge",challengeId:"c1",board:[[0]]});const id=e.snapshot().attemptId;e.start();h.tick(2400);e.markAssistance();e.setWrongGuardianPending("0,0");e.commitMistake();e.reset([[0]]);
 const a=e.snapshot();assert.equal(a.attemptId,id);assert.equal(a.challengeId,"c1");assert.equal(a.assistanceUsed,true);assert.equal(a.mistakeCommitted,true);assert.equal(a.activeDuration,2400);
 e.abandon();assert.equal(e.snapshot().state,ATTEMPT_STATES.ABANDONED);
}
{
 const h=harness(),e=h.make();e.create({questId:6,mode:"campaign",board:[[2]]});e.start();e.setWrongGuardianPending("0,0");
 const restored=h.make().restore({questId:6,mode:"campaign"});
 assert.equal(restored.wrongGuardianPending,"0,0");assert.equal(restored.mistakeCommitted,false);
}
// #761: qualification is decided when the run starts, never frozen at grid opening.
{
 const h=harness(),e=h.make();e.create({questId:9,mode:"campaign",qualifying:false,board:[[0]]});
 h.tick(16*60*1000);assert.equal(e.requalify(true).qualifying,true,"A not-yet-started run is promoted once the cooldown ended");
 e.start();assert.equal(e.requalify(false).qualifying,true,"A started run is never requalified");
 assert.equal(h.make().restore({questId:9,mode:"campaign"}).qualifying,true,"Promotion is durable");
 e.reset([[0]],{qualifying:false});assert.equal(e.snapshot().qualifying,true,"A reset never removes a started run's qualification");
 const r=h.make();r.create({questId:10,mode:"campaign",qualifying:false,board:[[0]]});r.start();h.tick(20*60*1000);
 // #851: a reset is the same run; only "Rejouer" (a new attempt) is requalified.
 assert.equal(r.reset([[0]],{qualifying:true}).qualifying,false,"A reset can never bypass the badge/ranking cooldown");
 assert.equal(r.reset([[0]]).qualifying,false);
 const c=h.make();c.create({questId:11,mode:"challenge",qualifying:false,board:[[0]]});
 assert.equal(c.requalify(true).qualifying,false,"Social challenges are never requalified");
 assert.equal(c.reset([[0]],{qualifying:true}).qualifying,false);
}
// #888: a challenge attempt resumes only for its own challenge, and a resume on
// another device starts from the server-measured elapsed time, never from zero.
{
 const h=harness(),engine=h.make();
 engine.create({questId:16,mode:'challenge',challengeId:'challenge-a',board:[[0]]});engine.start();h.tick(42_000);engine.pause();
 const other=h.make();
 assert.equal(other.restore({questId:16,mode:'challenge',challengeId:'challenge-b'}),null,'another challenge on the same quest never inherits the clock');
 assert.equal(other.peek().challengeId,'challenge-a','the untouched attempt stays readable');
 const same=h.make().restore({questId:16,mode:'challenge',challengeId:'challenge-a'});
 assert.equal(same.challengeId,'challenge-a');assert.equal(same.activeDuration,42_000,'same browser keeps its accumulated time');
 const device=h.make();
 const seeded=device.create({questId:16,mode:'challenge',challengeId:'challenge-c',board:[[0]],activeDuration:450_000});
 assert.equal(seeded.activeDuration,450_000);device.start();h.tick(5_000);
 assert.equal(device.activeMs(),455_000,'the resumed clock continues from the elapsed time');
 assert.equal(h.make().create({questId:16,mode:'campaign',board:[[0]],activeDuration:450_000}).activeDuration,0,'campaign runs can never be seeded');
}
console.log(JSON.stringify({attemptEngine:true,ready:true,activeTime:true,pause:true,restorePaused:true,resetKeepsRun:true,legacyRunIdentity:true,challengeResetOneShot:true,errorStatePersists:true,abandon:true}));
