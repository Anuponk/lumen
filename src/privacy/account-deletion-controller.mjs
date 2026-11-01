// UI controller: confirmation must reach the actual erasure flow.
export function createAccountDeletionController({flow,onStateChange}) {
 if(typeof flow!=='function'||typeof onStateChange!=='function')throw Error('Deletion UI dependencies required');
 let busy=false;
 const emit=status=>onStateChange({status,busy});
 return {async confirm(confirmation) {
  if(busy)return {status:'busy'};
  if(confirmation!=='SUPPRIMER'){emit('confirmation_required');return {status:'confirmation_required'};}
  busy=true;emit('deleting');
  try {
   const result=await flow(confirmation);
   if(result?.status==='completed'){emit('completed');return result;}
   if(result?.status==='local_cleanup_required'){emit('local_cleanup_required');return result;}
   emit('pending');return {status:'pending'};
  }catch{emit('failed');return {status:'failed'};}
  finally{busy=false;}
 }};
}
