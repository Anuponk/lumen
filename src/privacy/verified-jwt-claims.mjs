// Server-only JWT verification adapter for Supabase Auth.
// Prefer the Supabase client's getClaims(token), which validates the JWT
// signature against the project's JWKS. Never decode an unverified JWT.
export function createVerifiedJwtClaims({auth,now=()=>Date.now()}) {
  if(typeof auth?.getClaims!=='function')throw Error('Supabase Auth getClaims required');
  return async token=>{
    if(typeof token!=='string'||token.length<20||token.length>8192)throw Error('Invalid token');
    const {data,error}=await auth.getClaims(token);
    if(error||!data?.claims)throw Error('Invalid signed token');
    const claims=data.claims;
    if(typeof claims.sub!=='string'||typeof claims.session_id!=='string'||
       !Number.isFinite(claims.exp)||claims.exp*1000<=now())throw Error('Invalid JWT claims');
    return claims;
  };
}
