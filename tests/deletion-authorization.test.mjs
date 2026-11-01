import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDeletionAuthorization, validateDeletionConfirmation, deletionTarget } from '../src/privacy/deletion-authorization.mjs';
const user = { id: '00000000-0000-4000-8000-000000000001' };
const now = 1700000000000;
const session = { user_id: user.id, expires_at: now + 60000, revoked: false };
test('valid recent server identity resolves own account only', () => {
  const auth = validateDeletionAuthorization({ authenticatedUser: user, session, verifiedAt: now - 1000, now });
  assert.equal(deletionTarget(auth), user.id);
});
test('rejects missing, expired, revoked or foreign session', () => {
  for (const s of [null, {...session, expires_at: now}, {...session, revoked: true}, {...session, user_id: 'other'}]) {
    assert.throws(() => validateDeletionAuthorization({ authenticatedUser: user, session: s, verifiedAt: now, now }));
  }
});
test('rejects stale, future and client-omitted reauthentication', () => {
  for (const verifiedAt of [undefined, now - 300001, now + 1]) {
    assert.throws(() => validateDeletionAuthorization({ authenticatedUser: user, session, verifiedAt, now }));
  }
});
test('requires exact destructive confirmation', () => {
  assert.throws(() => validateDeletionConfirmation('oui'));
  assert.equal(validateDeletionConfirmation('SUPPRIMER'), true);
});
