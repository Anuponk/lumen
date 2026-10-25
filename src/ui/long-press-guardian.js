import {createGestureClickSuppression} from './gesture-click-suppression.js';
// Touch-only recognition. The UI owns all game rules and the actual mutation.
export function createLongPressGuardian({allowed,activate,clickScope=()=>null,schedule=setTimeout,unschedule=clearTimeout}={}){
 let pending=null;const pointers=new Set(),clicks=createGestureClickSuppression();
 function stop(suppress=false){
  if(pending?.timer!==null&&pending?.timer!==undefined)unschedule(pending.timer);
  if(suppress&&pending)clicks.suppress({pointerId:pending.id,pointerType:'touch'},pending.cell,clickScope(pending.cell));
  pending=null;
 }
 return {
  down(e,cell){
   if(!pointers.size)clicks.clear();
   if(e.pointerType!=='touch'){stop(true);return}
   pointers.add(e.pointerId);
   if(pointers.size>1){stop(true);return}
   if(e.isPrimary===false||!cell||!allowed(cell))return;
   pending={id:e.pointerId,x:e.clientX,y:e.clientY,cell,recognized:false,timer:null};
   const captured=pending;
   captured.timer=schedule(()=>{
    if(pending!==captured)return;
    captured.timer=null;captured.recognized=true;clicks.suppress(e,cell,clickScope(cell));
    if(allowed(cell))activate(cell);
   },500);
  },
  move(e){
   if(pending?.id===e.pointerId&&!pending.recognized&&Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>8)stop();
  },
  up(e){pointers.delete(e.pointerId);if(pending?.id===e.pointerId)stop()},
  cancel(){stop(true);pointers.clear()},
  active:()=>!!pending,
  multiTouch:()=>pointers.size>1,
  consumeClick:e=>clicks.consume(e)
 };
}
