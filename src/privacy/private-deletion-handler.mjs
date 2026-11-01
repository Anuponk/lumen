// Private HTTP entrypoint contract for #316. Mount ONLY on a trusted server.
// Dependencies must verify the bearer token and recent reauthentication against
// Supabase Auth on the server; no client-supplied UID or verifiedAt is accepted.
import { processAccountErasure } from './private-erasure-worker.mjs';

const json = (status, body) => ({status, headers:{'content-type':'application/json','cache-control':'no-store'}, body:JSON.stringify(body)});
export function createDeletionHandler({verifyRequest, resolveVerifiedActors, withOperatorTransaction, invalidateLumenSessions}) {
  if (![verifyRequest,resolveVerifiedActors,withOperatorTransaction,invalidateLumenSessions].every(x=>typeof x==='function')) {
    throw Error('Trusted private dependencies required');
  }
  return async function handle(request) {
    if (request.method !== 'POST') return json(405,{error:'method_not_allowed'});
    if (request.headers?.['content-type']?.split(';')[0] !== 'application/json') return json(415,{error:'unsupported_media_type'});
    if (!request.headers?.authorization?.startsWith('Bearer ')) return json(401,{error:'unauthorized'});
    let body;
    try {body=JSON.parse(request.body);if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='confirmation'))throw Error('unexpected fields');}
    catch{return json(400,{error:'invalid_request'});}
    if (body.confirmation !== 'SUPPRIMER') return json(400,{error:'confirmation_required'});
    let identity;
    try {identity=await verifyRequest(request.headers.authorization.slice(7));}
    catch{return json(401,{error:'unauthorized'});}
    if (!identity) return json(401,{error:'unauthorized'});
    try {
      const result=await processAccountErasure({
        authenticatedUser:identity.user,
        session:identity.session,
        verifiedAt:identity.serverVerifiedReauthAt,
        confirmation:body.confirmation,
        resolveVerifiedActors,withOperatorTransaction,
        onCompleted:invalidateLumenSessions
      });
      // The frontend must not claim complete deletion until post-commit cleanup succeeds.
      if (result.cleanupStatus!=='completed') return json(202,{status:'cleanup_pending'});
      return json(200,{status:'completed',authDeleted:false});
    } catch {
      // Avoid leaking private actor IDs, SQL details or account existence.
      return json(409,{error:'deletion_not_completed'});
    }
  };
}
