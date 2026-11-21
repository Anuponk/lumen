// Browsing only: the immediate canonical neighbour must pass the normal access guard.
import {createGestureClickSuppression} from './gesture-click-suppression.js';
export function reviewNeighbour(quests, currentId, direction, available) {
 const index=quests.findIndex(q=>q.id===currentId);
 if(index<0||![-1,1].includes(direction))return null;
 const target=quests[index+direction];
 return target&&available(target)?target:null;
}

export function bindReviewNavigation(host,{active,navigate,viewport=()=>globalThis.innerWidth}) {
 let start=null;
 const clicks=createGestureClickSuppression();
 const interactive=target=>!!target?.closest?.('button,a,input,textarea,select,[contenteditable="true"],[role="button"]');
 const horizontal=(dx,dy,min)=>Math.abs(dx)>=min&&Math.abs(dx)>Math.abs(dy)*1.6;
 host.addEventListener('pointerdown',event=>{
  clicks.clear();
  start=null;
  if(event.pointerType!=='touch'||!event.isPrimary||!active()||interactive(event.target))return;
  // Leave the browser/Android edge-back gesture entirely native.
  if(event.clientX<28||event.clientX>viewport()-28)return;
  start={id:event.pointerId,x:event.clientX,y:event.clientY,captured:false};
 });
 host.addEventListener('pointermove',event=>{
  if(!start||start.id!==event.pointerId||start.captured||!active())return;
  if(!horizontal(event.clientX-start.x,event.clientY-start.y,12))return;
  // Capture on the stable dialog only after horizontal intent. The podium may
  // replace the original target mid-swipe, while ordinary taps keep their target.
  host.setPointerCapture(event.pointerId);
  start.captured=true;
 });
 host.addEventListener('pointercancel',event=>{if(start?.id===event.pointerId)start=null});
 host.addEventListener('pointerup',event=>{
  if(start?.id!==event.pointerId)return;
  const origin=start;
  start=null;
  const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
  const turnsPage=active()&&horizontal(dx,dy,60);
  if(origin.captured||turnsPage)clicks.suppress(event,host,host);
  if(turnsPage)navigate(dx<0?1:-1);
 });
 host.addEventListener('click',event=>{if(clicks.consume(event)){event.preventDefault();event.stopImmediatePropagation()}},true);
 host.addEventListener('keydown',event=>{
  if(!active()||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||interactive(event.target))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   if(navigate(event.key==='ArrowRight'?1:-1))event.preventDefault();
  }
 });
}
