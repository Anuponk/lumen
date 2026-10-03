import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createGameEngine} from '../src/game/engine.js';
import {functionSource} from './source-tools.mjs';

const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const source=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
const context={document:{getElementById:()=>({checked:auto})}};
vm.createContext(context);let auto=true,board;
const names=['key','solutions','isAutoCross','verificationErrors','guardianConflicts','conflictMessage','proofEngine','directMissingCross','playerError','guardianOnlyState','guidedConflictForAction'];
vm.runInContext('var n,puz,state;'+names.map(name=>functionSource(source,name)).join('\n')+source.slice(source.indexOf('const CAT='),source.indexOf('const COLORS=')),context);
const catalogue=vm.runInContext('CAT',context);
const engine=createGameEngine(()=>board,()=>auto);
const plain=value=>JSON.parse(JSON.stringify(value));
let grids=0,deductions=0,guidedActions=0;
for(const puzzles of Object.values(catalogue))for(const p of puzzles){
 grids++;
 for(auto of [true,false]){
  board={n:p.reg.length,puz:p,state:Array.from({length:p.reg.length},()=>Array(p.reg.length).fill(0))};
  Object.assign(context,board);
  for(let step=0;step<200;step++){
   const before=context.proofEngine(),after=engine.proofEngine();
   assert.deepEqual(plain(after),plain(before),'Changed proof at grid '+grids+' step '+step);deductions++;
   if(after.kind==='none'||board.state.flat().filter(v=>v===2).length===board.n)break;
   board.state[after.cell[0]][after.cell[1]]=after.kind==='place'?2:1;
  }
 }
 // Exercise fresh and replaced board state, including wrong manual exclusions.
 for(const mode of ['empty','guardian','wrong-exclusion']){
  board={n:p.reg.length,puz:p,state:Array.from({length:p.reg.length},()=>Array(p.reg.length).fill(0))};
  if(mode==='guardian')board.state[0][p.sol[0]]=2;
  if(mode==='wrong-exclusion')board.state[0][p.sol[0]]=1;
  Object.assign(context,board);
  for(const name of ['solutions','verificationErrors','directMissingCross','playerError'])assert.deepEqual(plain(engine[name]()),plain(context[name]()),name+' changed');
  for(let r=0;r<board.n;r++)for(let c=0;c<board.n;c++){
   assert.deepEqual(plain(engine.guidedConflictForAction(r,c,2)),plain(context.guidedConflictForAction(r,c,2)),'Guided conflict changed');guidedActions++;
   assert.equal(engine.isAutoCross(r,c),context.isAutoCross(r,c));
  }
  const before=context.guardianConflicts(),after=engine.guardianConflicts();
  assert.deepEqual([...after.bad],[...before.bad]);assert.deepEqual([...after.reasons],[...before.reasons]);
 }
}
console.log(JSON.stringify({baseline,grids,deductions,guidedActions,result:'identical'}));
