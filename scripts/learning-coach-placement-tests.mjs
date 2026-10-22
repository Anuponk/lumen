import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/ui/game-screen.js','utf8');
const start=source.indexOf('function positionLearningCoach(){');
const end=source.indexOf('\nwindow.addEventListener("resize"',start);
assert(start>=0&&end>start,'use the real coach placement implementation');
for(const levelIndex of [0,1]){
 const card={hidden:false,style:{},get offsetHeight(){return Math.min(96,parseFloat(this.style.maxHeight)||96)}};
 card.parentElement={getBoundingClientRect:()=>({top:114,left:10}),scrollTop:0,scrollLeft:0};
 const help={getBoundingClientRect:()=>({top:5,bottom:41})};
 const document={getElementById:id=>id==='scriptedLearn'?card:id==='tutorialHelp'?help:null,querySelector:selector=>{assert.equal(selector,'.actions');return {getBoundingClientRect:()=>({top:570,bottom:609})}}};
 const board={getBoundingClientRect:()=>({top:114,bottom:540,left:20,right:340})};
 vm.runInNewContext(source.slice(start,end)+'\npositionLearningCoach();',{document,board,innerWidth:360,innerHeight:640,levelIndex});
 const top=parseFloat(card.style.top)+(card.style.position==='absolute'?card.parentElement.getBoundingClientRect().top:0),bottom=top+card.offsetHeight;
 assert(top>=help.getBoundingClientRect().bottom+8,'short-screen learning coach must leave the help button reachable, including its focus ring');
 assert(bottom<=board.getBoundingClientRect().top-8,'coach must fit before the board without covering cells');
 assert(bottom<570,'coach must leave the action row reachable');
}
// Bringing an off-screen header into view moves the board by 54px. The
// compact coach must move with it before any later frame/resize callback.
{
 let headerBottom=-13,boardTop=118;
 const card={hidden:false,style:{},get offsetHeight(){return Math.min(96,parseFloat(this.style.maxHeight)||96)}};
 const help={getBoundingClientRect:()=>({bottom:headerBottom})};
 const board={getBoundingClientRect:()=>({top:boardTop,bottom:500,left:20,right:340})};
 card.parentElement={getBoundingClientRect:()=>({top:boardTop,left:10}),scrollTop:0,scrollLeft:0};
 const document={getElementById:id=>id==='scriptedLearn'?card:help,querySelector:()=>({getBoundingClientRect:()=>({bottom:609})})};
 vm.runInNewContext(source.slice(start,end)+'\npositionLearningCoach();',{document,board,innerWidth:360,innerHeight:640,levelIndex:0});
 const viewportTop=()=>parseFloat(card.style.top)+(card.style.position==='absolute'?boardTop:0);
 assert(viewportTop()<41,'fixture reproduces the earlier off-screen-header placement');
 headerBottom=41;boardTop=172;
 assert(viewportTop()>=headerBottom+8,'bringing help into view must move its compact coach in the same coordinate space before the click');
 assert(viewportTop()+card.offsetHeight<=boardTop-8);
}
console.log('Learning coach: short-screen controls remain reachable when an off-screen header is brought into view.');
