// Presentation lifecycle only. Never validates a victory or changes a reward.
export function createVictoryPresentation(host,{reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,frame=callback=>requestAnimationFrame(callback),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let dispose=()=>{};
 function clear(){dispose();dispose=()=>{};delete host.dataset.victoryPhase}
 function start(onComplete){
  clear();let finished=false,cancelled=false;
  const button=host.querySelector('#skyRevealRanking');if(button)button.hidden=true;
  const minimum=delay(2000);
  if(reducedMotion())host.classList.add('celestial-still');
  host.dataset.victoryPhase='celebration';host.tabIndex=-1;host.focus({preventScroll:true});
  const detach=()=>button?.removeEventListener('click',open);
  const finish=()=>{if(finished||cancelled)return;finished=true;detach();host.classList.add('celestial-still');host.dataset.victoryPhase='ranking';onComplete();host.dispatchEvent(new Event('lumen:celebration-end'))};
  const open=()=>{if(host.dataset.victoryPhase==='admire'){if(button)button.hidden=true;finish()}};
  button?.addEventListener('click',open);
  const admire=()=>{if(cancelled||finished)return;host.dataset.victoryPhase='admire';if(button)button.hidden=false};
  dispose=()=>{cancelled=true;detach();if(button)button.hidden=true};
  // Wait for the actual finite CSS/Web Animations, including their delays.
  // Infinite ambient stars must never prevent the result from appearing.
  frame(()=>{if(cancelled||finished)return;if(reducedMotion()){minimum.then(admire);return}
   const animations=(host.getAnimations?.({subtree:true})||[]).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime));
   Promise.all([minimum,Promise.allSettled(animations.map(a=>a.finished))]).then(admire);
  });
 }
 return {start,clear};
}
