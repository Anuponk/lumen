import assert from 'node:assert/strict';
import { CAT } from '../src/campaign/catalogue.js';
import { learningStep, dragLearningStep, learningAllows, learningCopy } from '../src/game/learning.js';
import { createGameEngine } from '../src/game/engine.js';

const puzzle = CAT['5'][0];
const state = Array.from({ length: 5 }, () => Array(5).fill(0));
const board = { n: 5, puz: puzzle, state };
const engine = createGameEngine(() => board, () => false);
const phases = [];
let placements = 0;
for (let action = 0; action < 60; action++) {
  const before = structuredClone(state);
  const step = learningStep(puzzle, state);
  assert.deepEqual(state, before, 'The coach must never play for the user');
  if (step.phase === 'complete') break;
  phases.push(step.phase);
  if(step.number===1&&step.phase==='place')assert.equal(learningAllows(step,0,0),false,'The central singleton is the only permitted placement');
  if (step.phase === 'place') {
    const [r, c] = step.target;
    const territory = puzzle.reg[r][c];
    const possible = [];
    for (let y=0;y<5;y++) for(let x=0;x<5;x++) {
      if(puzzle.reg[y][x]===territory && state[y][x]===0) possible.push([y,x]);
    }
    assert.deepEqual(possible, [[r,c]], 'Every taught Guardian is a forced territory deduction');
    assert.equal(puzzle.sol[r], c);
    assert.equal(state[r][c], 0);
    state[r][c] = 1;
    assert.equal(learningStep(puzzle, state).phase, 'place', 'The first tap cannot advance the lesson');
    assert.match(learningCopy(learningStep(puzzle, state), state).copy, /encore|Encore/);
    state[r][c] = 2;
    placements++;
  } else {
    for (const [r,c] of step.cells) {
      assert.notEqual(puzzle.sol[r], c, 'The coach cannot request exclusion of a solution');
      assert.equal(state[r][c], 0, 'Existing marks are never replayed');
      state[r][c] = 1;
    }
  }
}
assert.equal(placements, 5);
assert.deepEqual(phases.slice(0, 5), ['place', 'row', 'column', 'neighbors', 'place']);
assert(phases.indexOf('drag') > phases.indexOf('reuse'), 'Drag follows the second deduction');
assert(phases.includes('practice'), 'The end retains lighter guidance');
assert.equal(learningStep(puzzle,state).phase,'complete');
assert.equal(engine.validateGuardians().nonTouching,true);
assert.equal(engine.validateGuardians().regs.size,5);
// Refresh derives the same step from the canonical persisted board, including a half tap.
const restored=Array.from({length:5},()=>Array(5).fill(0));restored[2][2]=1;
assert.deepEqual(learningStep(puzzle,structuredClone(restored)),learningStep(puzzle,restored));
assert.equal(learningAllows(learningStep(puzzle,restored),0,0),false);
assert.equal(learningStep(puzzle,Array.from({length:5},()=>Array(5).fill(0))).number,1);
console.log(JSON.stringify({learning:true,placements,phases,forcedDeductions:true,noAutomaticActions:true,restore:true}));

const second = CAT['5'][1];
const dragState = Array.from({length:5},()=>Array(5).fill(0));
assert.equal(second.reg.flat().filter(region=>region===second.reg[0][0]).length,1);
assert.equal(second.sol[0],0);
assert.equal(dragLearningStep(second,dragState).phase,'place');
dragState[0][0]=1;
assert.equal(dragLearningStep(second,dragState).phase,'place');
dragState[0][0]=2;
let lesson=dragLearningStep(second,dragState);
assert.equal(lesson.phase,'drag');
assert.equal(learningAllows(lesson,0,0),false);
assert.equal(learningAllows(lesson,1,1),false);
assert.match(learningCopy(lesson,dragState).copy,/bouton enfoncé/);
assert.match(learningCopy(lesson,dragState,true).copy,/doigt/);
dragState[0][1]=1;dragState[0][2]=1;
lesson=dragLearningStep(second,dragState);
assert.equal(lesson.phase,'drag');
assert.equal(learningAllows(lesson,0,1),true,'A partial drag can resume from an excluded cell');
assert.deepEqual(dragLearningStep(second,structuredClone(dragState)),lesson);
const beforeDrag=structuredClone(dragState);
dragLearningStep(second,dragState);
assert.deepEqual(dragState,beforeDrag,'The drag coach never marks cells itself');
for(const [r,c] of lesson.cells){assert.notEqual(second.sol[r],c);dragState[r][c]=1;}
assert.equal(dragLearningStep(second,dragState).phase,'complete');
console.log(JSON.stringify({quest2:true,partialDragRestore:true,protectedGuardian:true,freeAfterGesture:true}));

{
 const fs=(await import("node:fs")).default;
 const ui=fs.readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
 const handler=ui.slice(ui.indexOf("function dismissGuidedOnAnyTap("),ui.indexOf('document.addEventListener("pointerdown",dismissGuidedOnAnyTap,true)'));
 assert.ok(handler.includes("if(!sameAttempt)"),"Guided lock must reject other cells");
 assert.ok(handler.includes("if(cell){e.preventDefault();e.stopPropagation()}"),"Other cell pointer is swallowed");
 assert.ok(handler.includes("state[pending.r][pending.c]=1"),"Only erroneous Guardian may be removed");
 assert.ok(handler.includes("persistAttemptBoard()"),"Correction must persist");
 assert.ok(handler.includes("guidedPending=null"),"Unlock only after correcting wrong guardian");
 const ack=ui.slice(ui.indexOf("function closeGuidedConflict(){"),ui.indexOf("let suppressGuidedClickUntil",ui.indexOf("function closeGuidedConflict(){")));
 assert.ok(!ack.includes("guidedPending=null"),"Acknowledging must not unlock incorrect Guardian");
}
