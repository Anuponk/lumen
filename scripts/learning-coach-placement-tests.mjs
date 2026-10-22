import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/ui/game-screen.js','utf8');
const start=source.indexOf('function positionLearningCoach(){');
const end=source.indexOf('\nwindow.addEventListener("resize"',start);
assert(start>=0&&end>start,'use the real coach placement implementation');
for(const levelIndex of [0,1]){
 const card={hidden:false,style:{},get offsetHeight(){return Math.min(96,parseFloat(this.style.maxHeight)||96)}};
 const help={getBoundingClientRect:()=>({top:5,bottom:41})};
 const document={getElementById:id=>id==='scriptedLearn'?card:id==='tutorialHelp'?help:null,querySelector:selector=>{assert.equal(selector,'.actions');return {getBoundingClientRect:()=>({top:570,bottom:609})}}};
 const board={getBoundingClientRect:()=>({top:114,bottom:540,left:20,right:340})};
 vm.runInNewContext(source.slice(start,end)+'\npositionLearningCoach();',{document,board,innerWidth:360,innerHeight:640,levelIndex});
 const top=parseFloat(card.style.top),bottom=top+card.offsetHeight;
 assert(top>=help.getBoundingClientRect().bottom+8,'short-screen learning coach must leave the help button reachable, including its focus ring');
 assert(bottom<=board.getBoundingClientRect().top-8,'coach must fit before the board without covering cells');
 assert(bottom<570,'coach must leave the action row reachable');
}
console.log('Learning coach: short-screen header, board and action controls remain unobstructed.');
