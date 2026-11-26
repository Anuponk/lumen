// #708 (recette 24/11): the health of a player is the LAST KNOWN state, and its
// freshness is a separate, secondary fact. An inactive player is not « en
// difficulté » because the last signal is old; a persistent error does not vanish
// because its observation ages. Facts come from one bounded server read
// (lumen_admin_player_health): the current row of each device, the last completed
// quest (canonical/legacy receipts), an unresolved hydration failure and reports.
export const HEALTH_STATES = Object.freeze(['trouble', 'pending', 'healthy', 'unknown']);
export const HEALTH_VIEW = Object.freeze({
  trouble: { icon: '▲', label: 'En difficulté' },
  pending: { icon: '…', label: 'En attente' },
  healthy: { icon: '✓', label: 'Sain' },
  unknown: { icon: '?', label: 'Non évalué' },
});
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}(?: [0-9a-f]{7,40})?$/;
const NATIVE = /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}\+[0-9]{1,9}$/;
const stamp = (value) => {
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
};
const iso = (at) => (at === null ? null : new Date(at).toISOString());
const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

export function freshnessLabel(at, now = Date.now()) {
  if (at === null || at === undefined) return 'aucune observation';
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return 'il y a ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return 'il y a ' + hours + ' h';
  return 'il y a ' + Math.floor(hours / 24) + ' j';
}

export function playerHealth(facts, { now = Date.now() } = {}) {
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
    if (device.state === 'critical') trouble.push('Sauvegarde en échec sur un appareil');
    else if (device.state === 'review') trouble.push('Sauvegarde à vérifier sur un appareil');
    else if (count(device.failures) >= 3) trouble.push(count(device.failures) + ' échecs de synchronisation consécutifs');
    else if (device.state === 'auth' && n > 0) trouble.push('Reconnexion nécessaire pour envoyer ' + n + ' opération(s)');
    else if (n > 0) waiting.push(n + ' opération(s) en attente' + (since !== null ? ' depuis le ' + new Date(since).toLocaleString('fr-FR') : ''));
    if (device.storage_error === 'quota') trouble.push('Stockage local saturé');
    else if (device.storage_error === 'storage') trouble.push('Erreur de stockage local');
    else if (Number(device.storage_ratio) >= 80) trouble.push('Stockage local presque plein (' + Number(device.storage_ratio) + ' %)');
  }
  const hydrationAt = stamp(facts?.hydration?.at);
  if (hydrationAt !== null)
    trouble.push('Chargement du profil en échec non résolu depuis le ' + new Date(hydrationAt).toLocaleString('fr-FR'));
  const state = trouble.length ? 'trouble' : waiting.length ? 'pending' : devices.length ? 'healthy' : 'unknown';
  const reasons = state === 'trouble' ? [...new Set(trouble)] : state === 'pending' ? waiting : state === 'healthy' ? ['Aucune anomalie dans la dernière observation de chaque appareil'] : ['Aucune observation technique de ce compte'];
  const gameAt = stamp(facts?.game_at);
  const reports = facts?.reports && typeof facts.reports === 'object' ? facts.reports : null;
  return {
    state,
    ...HEALTH_VIEW[state],
    reasons,
    pending,
    devices: devices.length,
    observedAt: iso(observed),
    freshness: freshnessLabel(observed, now),
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
