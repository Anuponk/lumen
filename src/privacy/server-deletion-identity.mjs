// Server-only Supabase Auth identity verification for account erasure.
// Requires a trusted backend to provide a session lookup and a server-owned
// reauthentication ledger. A JWT iat or client timestamp is NOT reauthentication.
export function createVerifiedDeletionIdentity({getUserFromToken,lookupSession,lookupRecentReauth,now=()=>Date.now()}) {
  if (![getUserFromToken,lookupSession,lookupRecentReauth].every(f=>typeof f==='function')) {
    throw Error('Trusted server identity dependencies required');
  }
  return async function verifyRequest(token) {
    if (typeof token!=='string'||token.length<20||token.length>8192) throw Error('Invalid bearer token');
    const user=await getUserFromToken(token); // Supabase Auth getUser(token), not getSession/JWT decode
    if (!user?.id) throw Error('Unauthenticated');
    const session=await lookupSession(token,user.id); // must check auth.sessions, expiry and revocation
    if (!session||session.user_id!==user.id||session.revoked===true||
      !Number.isFinite(session.expires_at)||session.expires_at<=now()) throw Error('Inactive session');
    const verifiedAt=await lookupRecentReauth({userId:user.id,sessionId:session.id});
    if (!Number.isFinite(verifiedAt)||verifiedAt>now()||now()-verifiedAt>300000) {
      throw Error('Recent reauthentication required');
    }
    return {user,session,serverVerifiedReauthAt:verifiedAt};
  };
}
