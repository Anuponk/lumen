// A presentation state machine, never a persistence acknowledgement. Callers
// supply independently verified durability and server confirmation.
export function createSyncPresentation({onChange=()=>{}}={}){
 let state={status:'confirmed',celebrating:false,failures:0,incident:0,announced:false};
 const publish=()=>{const view={...state,alert:state.status==='critical'||(state.status==='persistent'&&!state.celebrating&&!state.announced)};onChange(view);return view};
 return {
  snapshot:()=>({...state}),
  celebration(active){state.celebrating=!!active;return publish()},
  pending({durable}){
   if(state.status==='confirmed'){state.incident++;state.failures=0;state.announced=false}
   state.status=durable?'pending':'critical';return publish();
  },
  failed({durable,retryable=true}){
   if(state.status==='confirmed'){state.incident++;state.announced=false}
   state.failures++;state.status=!durable?'critical':!retryable||state.failures>=3?'persistent':'pending';return publish();
  },
  acknowledged(){state={...state,status:'confirmed',failures:0,announced:false};return publish()},
  announced(){state.announced=true;return publish()},
  reset(){state={status:'confirmed',celebrating:false,failures:0,incident:0,announced:false};return publish()}
 };
}
