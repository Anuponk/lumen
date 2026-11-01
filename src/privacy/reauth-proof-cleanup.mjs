// #316: operator-only reauth proof cleanup, invoked after a successful
// Lumen data erasure. Never remove a shared Supabase Auth identity.
export function createReauthProofRevoker({query}) {
  if(typeof query!=='function')throw Error('Private PostgreSQL query required');
  return async userId=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId||''))throw Error('Verified user UUID required');
    await query('delete from lumen_privacy.reauth_proofs where user_id=$1::uuid',[userId]);
  };
}
export function createExpiredReauthProofPruner({query}) {
  if(typeof query!=='function')throw Error('Private PostgreSQL query required');
  return async()=>{
    const result=await query("delete from lumen_privacy.reauth_proofs where verified_at < now() - interval '5 minutes'");
    return result.rowCount??0;
  };
}
