// Presentation lifecycle only. Never validates a victory or changes a reward.
// Issue #661: the constellation and ranking share one persistent victory screen.
export function createVictoryPresentation(host,{reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,frame=callback=>requestAnimationFrame(callback)}={}){
 let dispose=()=>{};
 function clear(){dispose();dispose=()=>{};delete host.dataset.victoryPhase;host.classList.remove('celestial-still','victory-ranking-reveal')}
 function start(onComplete){
  clear();let finished=false,cancelled=false;
  const obsoleteButton=host.querySelector('#skyRevealRanking');
  if(obsoleteButton)obsoleteButton.hidden=true;
  const still=reducedMotion();
  if(still)host.classList.add('celestial-still');
  host.dataset.victoryPhase='combined';host.tabIndex=-1;host.focus({preventScroll:true});
  const skipClick=event=>{if(!event.target.closest?.('button,a,input,select,textarea,[role="button"]'))finish()};
  const skipKey=event=>{if(event.target===host&&['Enter',' '].includes(event.key)){event.preventDefault();finish()}};
  const detach=()=>{host.removeEventListener('click',skipClick);host.removeEventListener('keydown',skipKey)};
  const finish=()=>{if(finished||cancelled)return;finished=true;detach();onComplete();host.dispatchEvent(new Event('lumen:celebration-end'))};
  dispose=()=>{cancelled=true;detach();if(obsoleteButton)obsoleteButton.hidden=true};
  host.addEventListener('click',skipClick);host.addEventListener('keydown',skipKey);
  // Constellation and particle effects keep playing after the badges.
  frame(()=>{if(cancelled||finished)return;
   if(still){finish();return}
   const animations=(host.getAnimations?.({subtree:true})||[]).filter(a=>a.animationName==='victoryRewardIn'&&Number.isFinite(a.effect?.getComputedTiming().endTime));
   Promise.allSettled(animations.map(a=>a.finished)).then(finish);
  });
 }
 return {start,clear};
}
