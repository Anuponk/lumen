import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/ui/game-screen.js','utf8');
// #687: phones (<= 700 px) lay the coach out above the board; the compact
// fixed/absolute placement below remains for tablets (701-1100 px).
const start=source.indexOf('const COACH_ABOVE_MAX_WIDTH=');
const end=source.indexOf('\nwindow.addEventListener("resize"',start);
assert(start>=0&&end>start,'use the real coach placement implementation');
for(const levelIndex of [0,1]){
 const card={hidden:false,style:{},get offsetHeight(){return Math.min(96,parseFloat(this.style.maxHeight)||96)}};
 card.parentElement={getBoundingClientRect:()=>({top:114,left:10}),scrollTop:0,scrollLeft:0};
 const help={getBoundingClientRect:()=>({top:5,bottom:41})};
 const document={getElementById:id=>id==='scriptedLearn'?card:id==='tutorialHelp'?help:null,querySelector:selector=>{assert.equal(selector,'.actions');return {getBoundingClientRect:()=>({top:570,bottom:609})}}};
 const board={getBoundingClientRect:()=>({top:114,bottom:540,left:20,right:340})};
 vm.runInNewContext(source.slice(start,end)+'\npositionLearningCoach();',{document,board,innerWidth:800,innerHeight:640,autoMarkingLessonRequired:()=>false,activeQuestOrdinal:()=>1,QUEST_MILESTONES:{skyTourAfter:3},levelIndex});
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
 vm.runInNewContext(source.slice(start,end)+'\npositionLearningCoach();',{document,board,innerWidth:800,innerHeight:640,autoMarkingLessonRequired:()=>false,activeQuestOrdinal:()=>1,QUEST_MILESTONES:{skyTourAfter:3},levelIndex:0});
 const viewportTop=()=>parseFloat(card.style.top)+(card.style.position==='absolute'?boardTop:0);
 assert(viewportTop()<41,'fixture reproduces the earlier off-screen-header placement');
 headerBottom=41;boardTop=172;
 assert(viewportTop()>=headerBottom+8,'bringing help into view must move its compact coach in the same coordinate space before the click');
 assert(viewportTop()+card.offsetHeight<=boardTop-8);
}
// #687 phone branch: in-flow above the board, board shrunk by the coach height.
{
  const props = new Map();
  const wrap = { classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); } }, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
  const card = { hidden: false, style: { position: 'fixed', top: '50%', transform: 'translateY(-50%)', left: '10px', width: '340px', maxHeight: '420px', overflowY: 'auto' }, getBoundingClientRect: () => ({ height: 129.4 }) };
  const board = { getBoundingClientRect: () => ({ width: 370, top: 191, bottom: 561 }) };
  const document = { getElementById: (id) => (id === 'scriptedLearn' ? card : id === 'learningBoardWrap' ? wrap : null), querySelector: () => { throw Error('phones must not use the fixed placement'); } };
  const context = { document, board, innerWidth: 390, innerHeight: 844, autoMarkingLessonRequired: () => false, activeQuestOrdinal: () => 1, QUEST_MILESTONES: { skyTourAfter: 3 }, levelIndex: 0 };
  vm.runInNewContext(source.slice(start, end) + '\npositionLearningCoach();', { ...context });
  assert.equal(wrap.classList.set.has('coach-above'), true, 'phone coach is laid out above the board');
  assert.equal(props.get('--coach-height'), '130px');
  assert.equal(props.get('--coach-board-size'), '232px', 'board shrinks by the coach height (+8 px gap)');
  for (const key of ['position', 'top', 'transform', 'left', 'width', 'maxHeight', 'overflowY']) assert.equal(card.style[key], '', 'no fixed overlay placement: ' + key);
  card.hidden = true;
  vm.runInNewContext(source.slice(start, end) + '\npositionLearningCoach();', { ...context });
  assert.equal(wrap.classList.set.has('coach-above'), false, 'hidden coach releases the reserved space');
  assert.equal(props.size, 0);
  // A huge coach never shrinks the board below its playable minimum.
  card.hidden = false;
  card.getBoundingClientRect = () => ({ height: 400 });
  vm.runInNewContext(source.slice(start, end) + '\npositionLearningCoach();', { ...context });
  assert.equal(props.get('--coach-board-size'), '180px');
}
console.log('Learning coach: tablet short-screen controls remain reachable; phones place the coach above the board.');
