import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { learningCopy } from '../src/ui/learning-copy.js';
import { createTranslator } from '../src/ui/i18n.js';
const { t } = createTranslator();

const source=fs.readFileSync('src/ui/game-screen.js','utf8');
// #749: every width uses the phone layout, so the coach is always laid out above the
// board (#687 phone branch); the former tablet/desktop placement no longer exists.
const start=source.indexOf('const COACH_MIN_BOARD=');
const end=source.indexOf('\nwindow.addEventListener("resize"',start);
assert(start>=0&&end>start,'use the real coach placement implementation');
const stubbed='\nplaceCoachAboveBoard=c=>placed.push(c);clearCoachAboveBoard=()=>cleared.push(1);positionLearningCoach();';
for(const innerWidth of [390,800,1440,1920]){
 const card={hidden:false,style:{}},placed=[],cleared=[];
 const document={getElementById:id=>id==='scriptedLearn'?card:null};
 vm.runInNewContext(source.slice(start,end)+stubbed,{document,innerWidth,innerHeight:900,placed,cleared});
 assert.deepEqual([placed.length,cleared.length],[1,0],'Coach above the board at '+innerWidth+' px');
 card.hidden=true;placed.length=0;
 vm.runInNewContext(source.slice(start,end)+stubbed,{document,innerWidth,innerHeight:900,placed,cleared});
 assert.deepEqual([placed.length,cleared.length],[0,1],'Hidden coach releases its reserve at '+innerWidth+' px');
}
assert(!/innerWidth<=1100|COACH_ABOVE_MAX_WIDTH/.test(source),'No width-based coach branch remains');
// #687/#690 phone branch: the coach is in flow above the board with ONE reserve
// for the whole lesson (its longest step). The board keeps the same size on
// every step and only gives back what the reserve pushes past the screen.
function phoneFixture({ slackBelow, longest = 'x'.repeat(120), giveBack = 1 }) {
  const props = new Map(), classes = new Set();
  const wrap = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) }, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
  const title = { textContent: 'Observe le plateau' }, copy = { textContent: 'court' }, next = { hidden: false, textContent: 'Suivant' };
  // Card height follows its text, like the real wrapped copy.
  const card = { hidden: false, style: { position: 'fixed', top: '50%', transform: 'translateY(-50%)', left: '10px', width: '340px', maxHeight: '420px', overflowY: 'auto' }, getBoundingClientRect: () => ({ height: 60.4 + Math.ceil(copy.textContent.length / 40) * 16 + (next.hidden ? 0 : 34) }) };
  const natural = 370, innerHeight = 844, before = innerHeight - slackBelow;
  const board = { getBoundingClientRect: () => ({ width: natural }) };
  // Stack bottom: reserve + gap pushes it down, a smaller board pulls it up.
  const bottom = () => before + (classes.has('coach-above') ? parseFloat(props.get('--coach-height') || 0) + 8 - giveBack * (natural - parseFloat(props.get('--coach-board-size') || natural)) : 0);
  const document = { getElementById: (id) => ({ scriptedLearn: card, learningBoardWrap: wrap, scriptedLearnTitle: title, scriptedLearnCopy: copy, learningCoachNext: next })[id] ?? null, querySelector: () => ({ getBoundingClientRect: () => ({ bottom: bottom() }) }) };
  const intro = [{ title: 'Observe le plateau', copy: 'court' }, { title: 'Ton objectif', copy: longest }];
  const context = vm.createContext({ document, board, innerWidth: 390, innerHeight, scrollY: 0, matchMedia: () => ({ matches: true }), learningCopy, t, LEARNING_INTRO: intro, autoMarkingLessonRequired: () => false, activeQuestOrdinal: () => 1, QUEST_MILESTONES: { skyTourAfter: 3 }, levelIndex: 0 });
  vm.runInContext(source.slice(start, end), context);
  return { context, props, classes, card, title, copy, next, bottom, run: () => vm.runInContext('positionLearningCoach()', context) };
}
{
  // No room below: the board gives back the whole reserve, once.
  const t = phoneFixture({ slackBelow: 0 });
  t.run();
  assert.equal(t.classes.has('coach-above'), true, 'phone coach is laid out above the board');
  const reserve = parseFloat(t.props.get('--coach-height')), size = t.props.get('--coach-board-size');
  assert.equal(reserve, 61 + 3 * 16 + 34, 'reserve is the longest lesson step, not the current one');
  assert.equal(size, 370 - reserve - 8 + 'px');
  for (const key of ['position', 'top', 'transform', 'left', 'width', 'maxHeight', 'overflowY']) assert.equal(t.card.style[key], '', 'no fixed overlay placement: ' + key);
  assert.deepEqual([t.title.textContent, t.copy.textContent, t.next.hidden, t.next.textContent], ['Observe le plateau', 'court', false, 'Suivant'], 'measurement restores the visible step');
  // "Suivant" and the guided steps never resize the board.
  for (const [text, hidden] of [['x'.repeat(120), false], ['moyen '.repeat(10), true], ['', true]]) {
    t.copy.textContent = text; t.next.hidden = hidden; t.run();
    assert.equal(t.props.get('--coach-board-size'), size, 'board size is stable across lesson steps');
    assert.equal(parseFloat(t.props.get('--coach-height')), reserve);
  }
  t.card.hidden = true; t.run();
  assert.equal(t.classes.has('coach-above'), false, 'hidden coach releases the reserved space');
  assert.equal(t.props.size, 0);
}
{
  // Enough unused space below the actions: the board keeps its full size.
  const t = phoneFixture({ slackBelow: 260 });
  t.run();
  assert.equal(t.props.get('--coach-board-size'), '370px', 'space below the actions is used before shrinking the board');
  // Partial room: only the missing part is given back.
  const p = phoneFixture({ slackBelow: 100 });
  p.run();
  const reserve = parseFloat(p.props.get('--coach-height'));
  assert.equal(p.props.get('--coach-board-size'), 370 - (reserve + 8 - (100 - 8)) + 'px');
  // Real layout (#691 CI, 360x640): the stack re-centres, so shrinking the
  // board gives back only about half of its height. The board still converges
  // until the actions fit on screen.
  const c = phoneFixture({ slackBelow: 60, longest: 'x'.repeat(40), giveBack: 0.5 });
  c.run();
  assert(c.bottom() <= 844 - 8 + 1, 'actions fit after re-centring (' + c.bottom() + ')');
  assert(parseFloat(c.props.get('--coach-board-size')) > 180, 'the fit is reached above the minimum');
  // A huge lesson never shrinks the board below its playable minimum.
  const h = phoneFixture({ slackBelow: 0, longest: 'x'.repeat(1600) });
  h.run();
  assert.equal(h.props.get('--coach-board-size'), '180px');
}
console.log('Learning coach: above the board at every width (#749); one stable coach height reserved above the board.');
