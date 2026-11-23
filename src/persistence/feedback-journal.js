// #960 follow-up (incident #1010): the device's sync journal travels with a
// report, and players who share technical diagnostics send one automatically
// when the game is visibly stuck. The journal holds event names, timestamps,
// codes and counters only (same allowlist as lumen_commands.sanitize_feedback_journal):
// no profile, save, message, email or token.
export const JOURNAL_SOURCE_KEY = 'lumenCloudDiagnosticsV1';
export const AUTO_INCIDENT_KEY = 'lumenAutoIncidentV1';
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const TEXT = /^[A-Za-z0-9_:.+ -]{0,64}$/;
const scalar = (v) => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && TEXT.test(v));

function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.event !== 'string') return null;
  const out = {};
  for (const [key, value] of Object.entries(entry).slice(0, 24)) {
    if (!KEY.test(key)) continue;
    if (scalar(value)) out[key] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = {};
      for (const [sub, subValue] of Object.entries(value).slice(0, 16)) if (KEY.test(sub) && scalar(subValue)) nested[sub] = subValue;
      out[key] = nested;
    }
  }
  return typeof out.event === 'string' ? out : null;
}

export function buildFeedbackJournal(storage, { limit = 60 } = {}) {
  let raw = [];
  try {
    raw = JSON.parse(storage?.getItem?.(JOURNAL_SOURCE_KEY) || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.slice(-limit).map(cleanEntry).filter(Boolean);
}

// Incidents that leave a player stuck. One automatic report per device and
// window; each trigger needs repetition except an outright hydration failure.
const TRIGGERS = {
  hydration_failed: 1,
  legacy_victory_pending: 2,
  canonical_outbox_pending: 2,
  flush_failed: 3,
  flush_conflict: 2,
};
export function createAutoIncidentReporter({ storage, send, enabled, now = () => Date.now(), windowMs = 15 * 60e3, cooldownMs = 6 * 3600e3, delayMs = 4000, schedule = (fn, ms) => setTimeout(fn, ms) }) {
  const seen = new Map();
  let queued = false;
  function lastSent() {
    try {
      const at = Number(JSON.parse(storage.getItem(AUTO_INCIDENT_KEY) || 'null')?.at);
      return Number.isFinite(at) ? at : -Infinity;
    } catch {
      return -Infinity;
    }
  }
  function observe(event) {
    const need = TRIGGERS[event];
    if (!need || queued) return false;
    const t = now();
    const recent = (seen.get(event) || []).filter((at) => t - at < windowMs);
    recent.push(t);
    seen.set(event, recent);
    if (recent.length < need || !enabled() || t - lastSent() < cooldownMs) return false;
    queued = true;
    // A short delay lets the following events (summaries, retries) join the journal.
    schedule(async () => {
      try {
        if (!enabled() || now() - lastSent() < cooldownMs) return;
        await send({ code: event, count: recent.length, journal: buildFeedbackJournal(storage) });
        try {
          storage.setItem(AUTO_INCIDENT_KEY, JSON.stringify({ at: now(), code: event }));
        } catch {}
      } catch {
        /* the next qualifying incident retries; nothing else depends on it */
      } finally {
        queued = false;
        seen.clear();
      }
    }, delayMs);
    return true;
  }
  return { observe };
}
