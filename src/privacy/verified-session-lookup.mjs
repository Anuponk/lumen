// Private SQL-backed session lookup, callable only AFTER Auth getUser(token)
// and cryptographic JWT verification have established session_id.
export function createVerifiedSessionLookup({query,now=()=>Date.now()}) {
  if(typeof query!=='function')throw Error('Private PostgreSQL query required');
  return async function lookupSession({userId,sessionId}) {
    if(!/^[0-9a-f-]{36}$/i.test(userId||'')||!/^[0-9a-f-]{36}$/i.test(sessionId||''))throw Error('Verified UUIDs required');
    const result=await query(
      `select id::text as id,user_id::text as user_id,
              coalesce(extract(epoch from not_after)*1000,0) as expires_at
         from auth.sessions
        where id=$1::uuid and user_id=$2::uuid
        limit 1`,[sessionId,userId]);
    const row=result.rows?.[0];
    if(!row)return null;
    // Supabase may not populate not_after for all sessions. Never
    // treat a missing expiry as an indefinitely valid session.
    const expiresAt=Number(row.expires_at);
    if(!Number.isFinite(expiresAt)||expiresAt<=now())return null;
    return {id:row.id,user_id:row.user_id,expires_at:expiresAt,revoked:false};
  };
}
