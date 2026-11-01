// Private SQL-backed session lookup, callable only AFTER Auth getUser(token)
// and cryptographic JWT verification have established session_id.
export function createVerifiedSessionLookup({query,now=()=>Date.now()}) {
  if(typeof query!=='function')throw Error('Private PostgreSQL query required');
  return async function lookupSession({userId,sessionId,verifiedJwtExpiryMs}) {
    if(!/^[0-9a-f-]{36}$/i.test(userId||'')||!/^[0-9a-f-]{36}$/i.test(sessionId||''))throw Error('Verified UUIDs required');
    if(!Number.isFinite(verifiedJwtExpiryMs)||verifiedJwtExpiryMs<=now()) return null;
    const result=await query(
      `select id::text as id,user_id::text as user_id,
              extract(epoch from not_after)*1000 as expires_at
         from auth.sessions
        where id=$1::uuid and user_id=$2::uuid
        limit 1`,[sessionId,userId]);
    const row=result.rows?.[0];
    if(!row)return null;
    // not_after is nullable in Supabase. A cryptographically verified JWT
    // expiration is mandatory, and a populated DB limit can only shorten it.
    const dbExpiry=row.expires_at==null?Infinity:Number(row.expires_at);
    if(Number.isNaN(dbExpiry))return null;
    const expiresAt=Math.min(verifiedJwtExpiryMs,dbExpiry);
    if(expiresAt<=now())return null;
    return {id:row.id,user_id:row.user_id,expires_at:expiresAt,revoked:false};
  };
}
