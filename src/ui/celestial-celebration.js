// Presentation only: no timers/callbacks may validate a win or grant anything.
export function createCelestialCelebration(document){
 let cleanup=()=>{};
 function clear(){cleanup();cleanup=()=>{};const host=document.getElementById('skyReveal');if(!host)return;delete host.dataset.celestial;host.removeAttribute('aria-describedby');host.classList.remove('celestial-still');host.querySelectorAll('[data-celestial-extra]').forEach(e=>e.remove())}
 function show({kind,title,copy,summary,art,primary,secondary,review,share}){
  clear();const host=document.getElementById('skyReveal'),card=host?.querySelector('.sky-reveal-card');
  if(!card)return false;
  const originals=['skyRevealResults','skyRevealContinue','skyRevealTime','skyRevealRewards','skyRevealFeedback','skyRevealChallengeReason','skyRevealNext','skyRevealSky','skyRevealRetry','skyRevealShare'].map(id=>{const e=document.getElementById(id);return {e,hidden:e.hidden,disabled:e.disabled,text:e.tagName==='BUTTON'?e.textContent:null,click:e.onclick}});
  const restore=()=>originals.forEach(({e,hidden,disabled,text,click})=>{e.hidden=hidden;e.disabled=disabled;if(text!==null)e.textContent=text;e.onclick=click});
  cleanup=restore;
  host.dataset.celestial=kind;host.setAttribute('aria-labelledby','skyRevealTitle');host.setAttribute('aria-describedby','skyRevealName celestialSummary');
  document.getElementById('skyRevealKicker').textContent=kind==='constellation'?'UNE CONSTELLATION RÉVEILLÉE':'UN CIEL RALLUMÉ';
  document.getElementById('skyRevealTitle').textContent=title;
  document.getElementById('skyRevealName').textContent=copy;
  const canvas=document.getElementById('skyRevealCanvas');canvas.innerHTML=art;
  // Normalize only the decorative reveal dash, never the source coordinates.
  canvas.querySelectorAll('.sky-line').forEach(line=>line.setAttribute('pathLength','1'));
  const recap=document.createElement('p');recap.id='celestialSummary';recap.dataset.celestialExtra='';recap.className='celestial-summary';recap.textContent=summary;canvas.after(recap);
  const skip=document.createElement('button');skip.id='celestialSkip';skip.dataset.celestialExtra='';skip.className='celestial-skip';skip.textContent='Passer l’animation';skip.type='button';
  const finish=()=>{host.classList.add('celestial-still');skip.hidden=true;document.getElementById('skyRevealNext').focus()};skip.onclick=finish;card.prepend(skip);
  document.getElementById('skyRevealResults').hidden=false;document.getElementById('skyRevealContinue').hidden=true;
  for(const id of ['skyRevealTime','skyRevealRewards','skyRevealFeedback'])document.getElementById(id).hidden=true;
  const bind=(id,action)=>{const b=document.getElementById(id);b.hidden=!action;b.disabled=!!action?.disabled;b.classList.toggle('remarkable',!!action?.remarkable);if(action){b.textContent=action.label;b.onclick=action.run}};
  bind('skyRevealNext',primary);bind('skyRevealSky',secondary);bind('skyRevealRetry',review);bind('skyRevealShare',share);
  const key=e=>{if(e.key==='Escape'){e.preventDefault();finish()}if(e.key==='Tab'){const buttons=[...card.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled&&b.getClientRects().length);const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus()}};
  host.addEventListener('keydown',key);cleanup=()=>{host.removeEventListener('keydown',key);restore()};
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)finish();else skip.focus();
  return true;
 }
 return {show,clear};
}
