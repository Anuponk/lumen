// #708 (recette 24/11): the health of a player is the LAST KNOWN state, and its
// freshness is a separate, secondary fact. An inactive player is not « en
// difficulté » because the last signal is old; a persistent error does not vanish
// because its observation ages. Facts come from one bounded server read
// (lumen_admin_player_health): the current row of each device, the last completed
// quest (canonical/legacy receipts), an unresolved hydration failure and reports.
import { createTranslator } from './i18n.js';
const defaultT = createTranslator().t;
export const HEALTH_STATES = Object.freeze(['trouble', 'pending', 'healthy', 'unknown']);
export const HEALTH_ICONS = Object.freeze({ trouble: '▲', pending: '…', healthy: '✓', unknown: '?' });
const STATE_KEYS = { trouble: 'admin.health.state.trouble', pending: 'admin.health.state.pending', healthy: 'admin.health.state.healthy', unknown: 'admin.health.state.unknown' };
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}(?: [0-9a-f]{7,40})?$/;
const NATIVE = /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}\+[0-9]{1,9}$/;
const stamp = (value) => {
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
};
const iso = (at) => (at === null ? null : new Date(at).toISOString());
const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

export function freshnessLabel(at, now = Date.now(), t = defaultT) {
  if (at === null || at === undefined) return t('admin.health.noObservation');
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return t('admin.health.justNow');
  if (minutes < 60) return t('admin.health.agoMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('admin.health.agoHours', { count: hours });
  return t('admin.health.agoDays', { count: Math.floor(hours / 24) });
}

export function playerHealth(facts, { now = Date.now(), t = defaultT } = {}) {
  const date = (at) => new Date(at).toLocaleString(t('admin.dateLocale'));
  const devices = (Array.isArray(facts?.devices) ? facts.devices : []).filter((d) => d && typeof d === 'object');
  const trouble = [],
    waiting = [];
  let pending = 0,
    observed = null,
    web = null,
    android = null;
  for (const device of devices) {
    const at = stamp(device.observed_at);
    if (at !== null && at <= now + 60000 && (observed === null || at > observed)) observed = at;
    const version = typeof device.version === 'string' ? device.version : '';
    if (VERSION.test(version) && at !== null && (!web || at > web.at)) web = { version, at };
    const nativeAt = stamp(device.native_observed_at);
    if (typeof device.native_version === 'string' && NATIVE.test(device.native_version) && nativeAt !== null && (!android || nativeAt > android.at))
      android = { version: device.native_version, at: nativeAt };
    const n = count(device.pending);
    pending += n;
    const since = stamp(device.oldest_pending_at);
    if (device.state === 'critical') trouble.push(t('admin.health.saveFailed'));
    else if (device.state === 'review') trouble.push(t('admin.health.saveReview'));
    else if (count(device.failures) >= 3) trouble.push(t('admin.health.failures', { count: count(device.failures) }));
    else if (device.state === 'auth' && n > 0) trouble.push(t('admin.health.auth', { count: n }));
    else if (n > 0) waiting.push(since !== null ? t('admin.health.pendingSince', { count: n, date: date(since) }) : t('admin.health.pending', { count: n }));
    if (device.storage_error === 'quota') trouble.push(t('admin.health.storageFull'));
    else if (device.storage_error === 'storage') trouble.push(t('admin.health.storageError'));
    else if (Number(device.storage_ratio) >= 80) trouble.push(t('admin.health.storageNearlyFull', { ratio: Number(device.storage_ratio) }));
  }
  const hydrationAt = stamp(facts?.hydration?.at);
  if (hydrationAt !== null)
    trouble.push(t('admin.health.hydration', { date: date(hydrationAt) }));
  const state = trouble.length ? 'trouble' : waiting.length ? 'pending' : devices.length ? 'healthy' : 'unknown';
  const reasons = state === 'trouble' ? [...new Set(trouble)] : state === 'pending' ? waiting : [state === 'healthy' ? t('admin.health.healthyReason') : t('admin.health.unknownReason')];
  const gameAt = stamp(facts?.game_at);
  const reports = facts?.reports && typeof facts.reports === 'object' ? facts.reports : null;
  return {
    state,
    icon: HEALTH_ICONS[state],
    label: t(STATE_KEYS[state]),
    reasons,
    pending,
    devices: devices.length,
    observedAt: iso(observed),
    freshness: freshnessLabel(observed, now, t),
    gameAt: iso(gameAt),
    web: web ? { version: web.version, at: iso(web.at) } : null,
    android: android ? { version: android.version, at: iso(android.at) } : null,
    reports: { open: count(reports?.open), total: count(reports?.total), lastAt: reports?.last_at ?? null },
  };
}

export function healthCounts(models) {
  const counts = { all: 0, trouble: 0, pending: 0, healthy: 0, unknown: 0 };
  for (const model of models) {
    counts.all++;
    counts[model.state]++;
  }
  return counts;
}
