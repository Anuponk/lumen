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
 e.reset([[0,0],[0,0]]);assert.equal(e.snapshot().attemptId,id);assert.equal(e.snapshot().resetCount,1);assert.equal(e.activeMs(),2000);
 e.markAssistance();assert.equal(e.snapshot().assistanceUsed,true);
}
{
 const h=harness(),e=h.make();e.create({questId:4,mode:"replay",qualifying:true,board:[[1]]});e.start();h.tick(3333);e.updateBoard([[2]]);
 const id=e.snapshot().attemptId;
 const restored=h.make().restore({questId:4,mode:"replay"});
 assert.equal(restored.attemptId,id);assert.equal(restored.state,ATTEMPT_STATES.PAUSED);assert.deepEqual(restored.board,[[2]]);assert.equal(restored.activeDuration,3333);
 h.tick(10000);assert.equal(h.make().restore({questId:4,mode:"replay"}).activeDuration,3333);
}
{
 const h=harness(),e=h.make();e.create({questId:9,mode:"challenge",challengeId:"c1"});e.start();e.abandon();
 assert.equal(e.snapshot().state,ATTEMPT_STATES.ABANDONED);assert.equal(e.snapshot().challengeId,"c1");
}
console.log(JSON.stringify({attemptEngine:true,ready:true,activeTime:true,pause:true,restorePaused:true,resetSameAttempt:true,assistanceSticky:true,abandon:true}));
