// #316: composition root for the private deletion service.
// Only trusted server code may construct this dependency graph. The caller
// supplies independently verified Auth, actor ownership and DB operator access.
import {createDeletionHandler} from './private-deletion-handler.mjs';
import {createNodeDeletionRoute} from './node-deletion-route.mjs';
import {createSupabaseTokenVerifier} from './supabase-token-verifier.mjs';
import {createVerifiedActorResolver} from './verified-actor-resolver.mjs';
import {createErasureCompletion} from './erasure-completion.mjs';
export function createPrivateErasureEndpoint({
 supabaseAuth,verifyJwtClaims,lookupSession,lookupRecentReauth,
 loadVerifiedClaims,withOperatorTransaction,revokeReauthProofs,
 invalidateLumenSessions,now
}) {
 const verifyRequest=createSupabaseTokenVerifier({supabaseAuth,verifyJwtClaims,lookupSession,lookupRecentReauth,now});
 const resolveVerifiedActors=createVerifiedActorResolver({loadVerifiedClaims});
 const onCompleted=createErasureCompletion({revokeReauthProofs,invalidateLumenSessions});
 const handle=createDeletionHandler({verifyRequest,resolveVerifiedActors,withOperatorTransaction,invalidateLumenSessions:onCompleted});
 return createNodeDeletionRoute({handle});
}
