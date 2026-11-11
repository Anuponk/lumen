// Presentation lifecycle only. Never validates a victory or changes a reward.
export function createVictoryPresentation(host,{reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,frame=callback=>requestAnimationFrame(callback)}={}){
 let dispose=()=>{};
 function clear(){dispose();dispose=()=>{};delete host.dataset.victoryPhase}
 function start(onComplete){
  clear();let finished=false,cancelled=false;
  host.dataset.victoryPhase='celebration';host.tabIndex=-1;host.focus({preventScroll:true});
  const detach=()=>{host.removeEventListener('click',accelerate,true);host.removeEventListener('keydown',keyboard,true)};
  const finish=()=>{if(finished||cancelled)return;finished=true;detach();host.classList.add('celestial-still');host.dataset.victoryPhase='ranking';onComplete();host.dispatchEvent(new Event('lumen:celebration-end'))};
  const accelerate=e=>{e.preventDefault();e.stopImmediatePropagation();finish()};
  const keyboard=e=>{if(['Enter',' ','Escape'].includes(e.key)){if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return}accelerate(e)}};
  host.addEventListener('click',accelerate,true);host.addEventListener('keydown',keyboard,true);
  dispose=()=>{cancelled=true;detach()};
  // Wait for the actual finite CSS/Web Animations, including their delays.
  // Infinite ambient stars must never prevent the result from appearing.
  frame(()=>{if(cancelled||finished)return;if(reducedMotion()){finish();return}
   const animations=(host.getAnimations?.({subtree:true})||[]).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime));
   Promise.allSettled(animations.map(a=>a.finished)).then(finish);
  });
 }
 return {start,clear};
}
