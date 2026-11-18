// Presentation lifecycle only. Never validates a victory or changes a reward.
// Issue #661: the constellation and ranking share one persistent victory screen.
export function createVictoryPresentation(host,{reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,frame=callback=>requestAnimationFrame(callback),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let dispose=()=>{};
 function clear(){dispose();dispose=()=>{};delete host.dataset.victoryPhase;host.classList.remove('celestial-still','victory-ranking-reveal')}
 function start(onComplete){
  clear();let finished=false,cancelled=false;
  const obsoleteButton=host.querySelector('#skyRevealRanking');
  if(obsoleteButton)obsoleteButton.hidden=true;
  const minimum=delay(2000);
  if(reducedMotion())host.classList.add('celestial-still');
  host.dataset.victoryPhase='combined';host.tabIndex=-1;host.focus({preventScroll:true});
  const finish=()=>{if(finished||cancelled)return;finished=true;onComplete();host.dispatchEvent(new Event('lumen:celebration-end'))};
  dispose=()=>{cancelled=true;if(obsoleteButton)obsoleteButton.hidden=true};
  // The podium waits for the product minimum and the badge reveal only.
  // Constellation and particle effects keep playing on the shared screen.
  frame(()=>{if(cancelled||finished)return;
   if(reducedMotion()){minimum.then(finish);return}
   const animations=(host.getAnimations?.({subtree:true})||[]).filter(a=>a.animationName==='victoryRewardIn'&&Number.isFinite(a.effect?.getComputedTiming().endTime));
   Promise.all([minimum,Promise.allSettled(animations.map(a=>a.finished))]).then(finish);
  });
 }
 return {start,clear};
}
