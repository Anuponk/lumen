// Trusted Supabase Auth adapter. Only the verified Auth response may establish
// user identity. The session_id claim is merely a lookup key after JWT validation.
export function createSupabaseTokenVerifier({supabaseAuth,verifyJwtClaims,lookupSession,lookupRecentReauth,now=()=>Date.now()}) {
  if (![verifyJwtClaims,lookupSession,lookupRecentReauth].every(x=>typeof x==='function')||
      typeof supabaseAuth?.getUser!=='function') throw Error('Trusted Auth dependencies required');
  return async token=>{
    if(typeof token!=='string'||token.length<20||token.length>8192) throw Error('Invalid token');
    const [{data,error},claims]=await Promise.all([supabaseAuth.getUser(token),verifyJwtClaims(token)]);
    if(error||!data?.user?.id||!claims||claims.sub!==data.user.id||
       typeof claims.session_id!=='string'||!claims.session_id) throw Error('Invalid Auth identity');
    if(!Number.isFinite(claims.exp)||claims.exp*1000<=now())throw Error('Expired signed token');
    const session=await lookupSession({userId:data.user.id,sessionId:claims.session_id,verifiedJwtExpiryMs:claims.exp*1000});
    if(!session||session.id!==claims.session_id||session.user_id!==data.user.id||
       session.revoked===true||!Number.isFinite(session.expires_at)||session.expires_at<=now()) {
      throw Error('Inactive Auth session');
    }
    const verifiedAt=await lookupRecentReauth({userId:data.user.id,sessionId:claims.session_id});
    if(!Number.isFinite(verifiedAt)||verifiedAt>now()||now()-verifiedAt>300000) {
      throw Error('Recent reauthentication required');
    }
    return {user:data.user,session,serverVerifiedReauthAt:verifiedAt};
  };
}
