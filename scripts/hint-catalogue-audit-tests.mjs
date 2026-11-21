// #828: every published quest must be solvable from an empty grid by the
// player-facing hint engine (no "none" before the solution), with and without
// automatic marking, and a completed grid must never be sent to the solver.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {createGameEngine} from '../src/game/engine.js';

const quests=canonicalQuestList();
const failures=[];
for(const q of quests)for(const auto of [false,true]){
 const n=q.reg.length,board={n,puz:{reg:q.reg,sol:q.sol},state:Array.from({length:n},()=>Array(n).fill(0))};
 const engine=createGameEngine(()=>board,()=>auto);
 let solved=false;
 for(let step=0;step<4*n*n&&!solved;step++){
  if(board.state.every((row,r)=>row[q.sol[r]]===2)){solved=true;break}
  const cross=engine.directMissingCross();if(cross){board.state[cross[0]][cross[1]]=1;continue}
  const h=engine.simpleForcedPlacement()||engine.proofEngine();
  if(h.kind==='place'){board.state[h.cell[0]][h.cell[1]]=2;continue}
  if(h.kind==='elim'){board.state[h.cell[0]][h.cell[1]]=1;continue}
  break;
 }
 if(!solved)failures.push({ordinal:q.ordinal,id:q.id,auto});
}
assert.deepEqual(failures,[],'Every published quest is explainable by hints from an empty grid');
// Quest 23 (Croix du Sud 3/10) from the #828 report, explicitly.
const q23=quests.find(q=>q.ordinal===23);assert.ok(q23,'Quest 23 is published');
{
 const n=q23.reg.length,state=q23.sol.map(c=>Array.from({length:n},(_,x)=>x===c?2:0));
 const engine=createGameEngine(()=>({n,puz:{reg:q23.reg,sol:q23.sol},state}),()=>false);
 // Root cause of #828: a completed grid has nothing left to deduce.
 assert.equal(engine.proofEngine().kind,'none');
 assert.equal(engine.playerError(),null);
}
// UI contract: a completed valid grid is validated (no hint counted), and no
// internal solver verdict can reach the player.
const ui=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const hint=ui.slice(ui.indexOf('document.getElementById("hint").onclick=()=>{'));
assert(hint.indexOf('if(guardiansCompleteAndValid()){')<hint.indexOf('recordHintUse();'),'A completed grid is checked before a hint is counted');
assert.doesNotMatch(ui,/solveur explicable|ne devrait pas être dans le catalogue/);
assert.match(ui,/if\(authWasPending&&!celebrated&&!pendingVictoryView&&!socialChallenge&&guardiansCompleteAndValid\(\)\)/,'A victory deferred by Auth restoration is validated afterwards');
console.log(`Hint catalogue audit (#828): ${quests.length} quests × 2 marking modes explainable from empty; completed-grid hint and deferred victory guarded`);
