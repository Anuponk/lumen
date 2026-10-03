import {CAT} from "../campaign/catalogue.js";
export function createDiagnostics(model,api){
const {init,runHintTests,setSoundEnabled,closeTutorial,hideSuccess,render}=api;
return {
 async runAllHintTests(){
  model.levelIndex=2;init();const suites=[];
  for(const size of [5,6,7,8]){
   model.n=size;model.puz=CAT[size][0];model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
   const results=await runHintTests();suites.push({size,total:results.length,failures:results.filter(t=>!t.ok)});
  }
  return suites;
 },
 snapshot(){return {n:model.n,levelIndex:model.levelIndex,puz:model.puz,state:model.state,celebrated:model.celebrated,replayMode:model.replayMode,progress:model.lumenProgress}},
 setupQuest(index){
  // Browser tests call this immediately after runAllHintTests(), whose final
  // embedded suite may leave transient tutorial/overlay state active. Clear
  // those surfaces before re-entering init so the diagnostic transition is
  // deterministic and cannot wait on a UI animation/timer.
  // `init()` already normalizes overlays and board state. Keep this hook to a
  // single synchronous transition so CDP can return deterministically.
  model.levelIndex=index;init();closeTutorial(false);
 },
 setBoard(value){model.state=value;render()}
};
}
