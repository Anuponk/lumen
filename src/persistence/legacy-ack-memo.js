// #1010 · Local memory of legacy victories the server has acknowledged.
// On a cold start the restored, already-won board is celebrated again before
// the cloud profile is ready. Without this memo that run was captured a second
// time, replayed, and the page reloaded twice on every launch. The memo is only
// written from a server receipt and only skips a redundant capture of the same
// operation: it never grants, never acknowledges an outbox entry and never
// replaces the server's one-receipt-per-operation authority.
export const LEGACY_ACK_KEY = 'lumenLegacyAcknowledgedV1';
const LIMIT = 30;
const OP = /^[A-Za-z0-9._-]{1,120}$/;

function readAll(storage) {
  try {
    const value = JSON.parse(storage?.getItem?.(LEGACY_ACK_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

export function rememberLegacyAck(storage, ownerId, receipt) {
  const request = receipt?.request,
    outcome = receipt?.outcome;
  if (!ownerId || !request || !OP.test(request.operationId || '') || typeof request.questId !== 'string') return false;
  if (!request.facts || typeof request.facts !== 'object' || !outcome || typeof outcome.firstCompletion !== 'boolean') return false;
  const item = { owner: ownerId, operationId: request.operationId, questId: request.questId, facts: request.facts, outcome, recordedAt: receipt.recordedAt ?? null };
  const others = readAll(storage).filter((x) => !(x.owner === ownerId && x.operationId === item.operationId));
  const mine = others.filter((x) => x.owner === ownerId).slice(-(LIMIT - 1));
  const next = [...others.filter((x) => x.owner !== ownerId).slice(-LIMIT), ...mine, item];
  try {
    storage.setItem(LEGACY_ACK_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function findLegacyAck(storage, ownerId, operationId, questId) {
  if (!ownerId || !operationId) return null;
  return readAll(storage).find((x) => x.owner === ownerId && x.operationId === operationId && x.questId === questId) || null;
}
