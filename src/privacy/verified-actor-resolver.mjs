// #316: secure server-side actor scope resolution.
// No analytics co-occurrence, email similarity, or client-provided aliases
// can establish ownership. Only authenticated claim receipts may do so.
export function createVerifiedActorResolver({loadVerifiedClaims}) {
  if(typeof loadVerifiedClaims!=='function')throw Error('Trusted claim receipt reader required');
  return async userId=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId||''))throw Error('Verified user UUID required');
    const claims=await loadVerifiedClaims(userId);
    if(!Array.isArray(claims))throw Error('Verified actor scope unavailable');
    const actors=[];
    for(const claim of claims) {
      if(!claim||claim.user_id!==userId||claim.verified!==true||
         typeof claim.actor_id!=='string'||claim.actor_id.length<1||claim.actor_id.length>256) {
        throw Error('Ambiguous or unverified actor ownership');
      }
      actors.push(claim.actor_id);
    }
    if(actors.length>200||new Set(actors).size!==actors.length)throw Error('Invalid actor scope');
    return actors.sort();
  };
}
