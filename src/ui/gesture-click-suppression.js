// Consume only the compatibility click belonging to an already handled gesture.
// A new pointerdown clears suppression, so subsequent input never waits a timer.
export function createGestureClickSuppression(){
 let consumed=null;
 return {
  clear(){consumed=null},
  suppress(e,cell,scope){consumed={id:e.pointerId,pointerType:e.pointerType,cell,scope}},
  consume(e){
   if(!consumed||e.detail===0)return false;
   const samePointer=e.pointerType&&e.pointerType===consumed.pointerType&&e.pointerId===consumed.id;
   if(!samePointer&&!(consumed.cell===e.target||consumed.cell?.contains(e.target)||consumed.scope?.contains(e.target)))return false;
   consumed=null;return true;
  }
 };
}
