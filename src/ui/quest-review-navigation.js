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
 host.addEventListener('pointerdown',()=>clicks.clear());
 host.addEventListener('click',event=>{if(clicks.consume(event)){event.preventDefault();event.stopImmediatePropagation()}},true);
 const interactive=target=>!!target?.closest?.('button,a,input,textarea,select,[contenteditable="true"],[role="button"]');
 host.addEventListener('touchstart',event=>{
  start=null;
  clicks.clear();
  if(!active()||event.touches.length!==1||interactive(event.target))return;
  const t=event.touches[0];
  // Leave the browser/Android edge-back gesture entirely native.
  if(t.clientX<28||t.clientX>viewport()-28)return;
  start={x:t.clientX,y:t.clientY};
 },{passive:true});
 host.addEventListener('touchcancel',()=>{start=null},{passive:true});
 host.addEventListener('touchend',event=>{
  const origin=start;start=null;
  if(!origin||!active()||event.changedTouches.length!==1)return;
  const t=event.changedTouches[0],dx=t.clientX-origin.x,dy=t.clientY-origin.y;
  if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.6){
   clicks.suppress({pointerType:'touch'},host,host);
   navigate(dx<0?1:-1);
  }
 },{passive:true});
 host.addEventListener('keydown',event=>{
  if(!active()||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||interactive(event.target))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
   if(navigate(event.key==='ArrowRight'?1:-1))event.preventDefault();
  }
 });
}
