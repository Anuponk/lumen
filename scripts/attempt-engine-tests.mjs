import assert from "node:assert/strict";
import {createAttemptEngine,ATTEMPT_STATES} from "../src/game/attempt-engine.js";

function harness(){
 const data=new Map();let wall=1_000_000,mono=10_000;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const make=()=>createAttemptEngine({storage,now:()=>wall,perfNow:()=>mono});
 return {storage,make,tick(ms){wall+=ms;mono+=ms}};
}
{
 const h=harness(),e=h.make(),a=e.create({questId:27,mode:"campaign",board:[[0,0],[0,0]]});
 assert.equal(a.state,ATTEMPT_STATES.READY);h.tick(5000);assert.equal(e.activeMs(),0);
 const id=a.attemptId;e.start();h.tick(1250);assert.equal(e.activeMs(),1250);
 e.pause();h.tick(9000);assert.equal(e.activeMs(),1250);assert.equal(e.snapshot().attemptId,id);
 e.resume();h.tick(750);assert.equal(e.activeMs(),2000);
 e.markAssistance();e.setWrongGuardianPending("0,0");e.commitMistake();
 e.reset([[0,0],[0,0]]);
 assert.equal(e.snapshot().attemptId,id);assert.equal(e.snapshot().resetCount,1);assert.equal(e.activeMs(),0);
 assert.equal(e.snapshot().assistanceUsed,false);assert.equal(e.snapshot().mistakeCommitted,false);assert.equal(e.snapshot().wrongGuardianPending,null);
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
console.log(JSON.stringify({attemptEngine:true,ready:true,activeTime:true,pause:true,restorePaused:true,resetFreshBadgeRun:true,challengeResetOneShot:true,errorStatePersists:true,abandon:true}));
