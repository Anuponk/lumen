// #316: run post-commit cleanup in a fixed order. This is deliberately
// separate from PostgreSQL erasure: no shared auth.users deletion.
export function createErasureCompletion({revokeReauthProofs,invalidateLumenSessions}) {
  if(typeof revokeReauthProofs!=='function'||typeof invalidateLumenSessions!=='function')throw Error('Private cleanup dependencies required');
  return async userId=>{
    // Revoke proof first so a failed session invalidation cannot leave a
    // reusable destructive authorization behind.
    await revokeReauthProofs(userId);
    await invalidateLumenSessions(userId);
  };
}
