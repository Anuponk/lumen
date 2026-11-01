// #316: operator-only actor ownership lookup. This reader is intentionally
// fail-closed: absence of independently verified ownership does not imply
// permission to delete data tied to an anonymous actor.
export function createPostgresVerifiedClaimReader({query}) {
 if(typeof query!=='function')throw Error('Private database query required');
 return async userId=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId||''))throw Error('Verified user UUID required');
  const result=await query(`select user_id::text,actor_id,verified
    from lumen_privacy.verified_actor_ownership
    where user_id=$1::uuid and verified=true
    order by actor_id limit 201`,[userId]);
  if(!Array.isArray(result.rows))throw Error('Verified actor claims unavailable');
  return result.rows;
 };
}
