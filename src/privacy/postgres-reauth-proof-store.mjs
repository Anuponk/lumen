// #316: private, parameterized PostgreSQL storage for recent verified
// reauthentication. Table must be provisioned in the operator-only schema.
// Never accept client-supplied verifiedAt values.
export function createPostgresReauthProofStore({query,now=()=>Date.now()}) {
  if(typeof query!=='function')throw Error('Private database query required');
  return {
    async writeProof({userId,sessionId,verifiedAt}) {
      if(!Number.isFinite(verifiedAt)||Math.abs(now()-verifiedAt)>1000)throw Error('Server clock mismatch');
      await query(`insert into lumen_privacy.reauth_proofs(user_id,session_id,verified_at)
        values($1::uuid,$2::uuid,to_timestamp($3::double precision/1000))
        on conflict(user_id,session_id) do update set verified_at=excluded.verified_at`,
        [userId,sessionId,verifiedAt]);
    },
    async readProof({userId,sessionId}) {
      const result=await query(`select extract(epoch from verified_at)*1000 as verified_at
        from lumen_privacy.reauth_proofs
        where user_id=$1::uuid and session_id=$2::uuid
          and verified_at>now()-interval '5 minutes'
        limit 1`,[userId,sessionId]);
      const value=result.rows?.[0]?.verified_at;
      return value==null?null:{verifiedAt:Number(value)};
    }
  };
}
