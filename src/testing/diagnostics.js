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
 setupQuest(index){model.levelIndex=index;init();setSoundEnabled(false);document.getElementById("autoCross").checked=false;document.getElementById("guidedErrors").checked=false;closeTutorial(false);document.getElementById("skyReveal").hidden=true;hideSuccess()},
 setBoard(value){model.state=value;render()}
};
}
