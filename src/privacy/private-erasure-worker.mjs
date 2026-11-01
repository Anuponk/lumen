// Private worker core. No HTTP exposure, secrets or database credentials in this module.
// Only the trusted server adapter can supply identity, reauth proof and database transaction.
import { validateDeletionAuthorization, validateDeletionConfirmation, deletionTarget } from './deletion-authorization.mjs';

export async function processAccountErasure({
  authenticatedUser, session, verifiedAt, confirmation, now = Date.now(),
  resolveVerifiedActors, withOperatorTransaction, onCompleted
}) {
  const authorization = validateDeletionAuthorization({ authenticatedUser, session, verifiedAt, now });
  validateDeletionConfirmation(confirmation);
  if (typeof resolveVerifiedActors !== 'function' || typeof withOperatorTransaction !== 'function') {
    throw new Error('Private trusted worker dependencies required');
  }
  const userId = deletionTarget(authorization);
  const actors = await resolveVerifiedActors(userId);
  if (!Array.isArray(actors) || actors.length > 200 ||
      actors.some(a => typeof a !== 'string' || a.length < 1 || a.length > 256) ||
      new Set(actors).size !== actors.length) {
    throw new Error('Verified actor scope invalid or ambiguous');
  }
  // The adapter must connect as a private PostgreSQL owner with read committed isolation,
  // and commit atomically. Never use Supabase REST/service_role for this operation.
  const result = await withOperatorTransaction(async tx => {
    if (!tx || typeof tx.review !== 'function' || typeof tx.erase !== 'function') {
      throw new Error('Private transaction adapter required');
    }
    await tx.review(userId, actors);
    return tx.erase(userId, actors, 'ERASE LUMEN ' + userId);
  });
  // A successful transaction is necessary but not sufficient for end-user completion:
  // caller must also enforce session invalidation and local cleanup.
  let cleanupStatus = 'pending';
  if (typeof onCompleted === 'function') {
    try { await onCompleted(userId); cleanupStatus = 'completed'; }
    catch { cleanupStatus = 'failed'; }
  }
  return { status: 'erasure_committed', cleanupStatus, authDeleted: false, report: result };
}
