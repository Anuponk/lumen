// Minimal, server-owned recent reauthentication proof store.
// A successful password or OAuth challenge must be verified by a separate
// trusted adapter before calling recordVerifiedReauth. Never accept client
// timestamps, tokens or user metadata as evidence.
export function createRecentReauthLedger({writeProof,readProof,now=()=>Date.now()}) {
  if(typeof writeProof!=='function'||typeof readProof!=='function')throw Error('Private proof storage required');
  const validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
  return {
    async recordVerifiedReauth({userId,sessionId,verifiedProviderChallenge}) {
      if(!validId(userId)||!validId(sessionId)||verifiedProviderChallenge!==true)throw Error('Verified provider challenge required');
      const verifiedAt=now();
      await writeProof({userId,sessionId,verifiedAt});
      return {verifiedAt};
    },
    async lookupRecentReauth({userId,sessionId}) {
      if(!validId(userId)||!validId(sessionId))return null;
      const proof=await readProof({userId,sessionId});
      const verifiedAt=proof?.verifiedAt;
      if(!Number.isFinite(verifiedAt)||verifiedAt>now()||now()-verifiedAt>300000)return null;
      return verifiedAt;
    }
  };
}
