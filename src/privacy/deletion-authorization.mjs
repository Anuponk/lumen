// #316: shared, side-effect-free validation for the private deletion service.
// This module deliberately has no database access and cannot erase an account.
export const MAX_REAUTH_AGE_MS = 5 * 60 * 1000;

export function validateDeletionAuthorization({ authenticatedUser, session, verifiedAt, now = Date.now() }) {
  if (!authenticatedUser || typeof authenticatedUser.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authenticatedUser.id)) {
    throw new Error('Authenticated user required');
  }
  if (!session || session.user_id !== authenticatedUser.id ||
      session.revoked === true || session.expires_at <= now) {
    throw new Error('Valid active session required');
  }
  if (!Number.isFinite(verifiedAt) || verifiedAt > now ||
      now - verifiedAt > MAX_REAUTH_AGE_MS) {
    throw new Error('Recent server-verified reauthentication required');
  }
  return Object.freeze({ userId: authenticatedUser.id });
}

export function validateDeletionConfirmation(value) {
  if (value !== 'SUPPRIMER') throw new Error('Explicit deletion confirmation required');
  return true;
}

// The actor must always be resolved from the verified server identity.
// Never accept target UUID, actor aliases or owner credentials from a client request.
export function deletionTarget(authorization) {
  if (!authorization || typeof authorization.userId !== 'string') {
    throw new Error('Verified authorization required');
  }
  return authorization.userId;
}
