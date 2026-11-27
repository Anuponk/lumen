// #960: technical snapshot taken at the exact moment a bug is reported. It only
// reads what is already in memory or local storage (no Supabase request) and
// follows the server allowlist (lumen_commands.sanitize_feedback_snapshot):
// key names, scalars, one nested level of scalars and the board as digits.
// No profile, save, message, email, token, account or device identifier.
const TEXT = /^[A-Za-z0-9_:.+ -]{0,64}$/;
const SUCCESS = new Set(['hydration_ready', 'flush_success', 'outbox_acknowledged', 'sync_confirmed', 'profile_saved']);
const FAILURE = /fail|conflict|error|blocked|refused|rejected/;

const text = (value) => {
  const s = String(value ?? '').replace(/[^A-Za-z0-9_:.+ -]/g, ' ').trim().slice(0, 64);
  return s && TEXT.test(s) ? s : null;
};
const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.min(100000, Math.floor(value)) : null);

// Board cells are small integers (0 empty, 1 cross, 2 guardian, 3 automatic cross).
export function encodeBoard(board) {
  if (!Array.isArray(board) || !board.length || board.length > 20) return null;
  const rows = [];
  for (const row of board) {
    if (!Array.isArray(row) || !row.length || row.length > 20) return null;
    const cells = row.map((cell) => (Number.isInteger(cell) && cell >= 0 && cell <= 9 ? String(cell) : null));
    if (cells.includes(null)) return null;
    rows.push(cells.join(''));
  }
  return rows.join('/');
}

// Last confirmation and last error from the local sync journal (already kept).
export function journalMilestones(journal) {
  let success = null,
    failure = null;
  for (const entry of Array.isArray(journal) ? journal : []) {
    if (!entry || typeof entry.event !== 'string') continue;
    if (SUCCESS.has(entry.event)) success = entry;
    else if (FAILURE.test(entry.event)) failure = entry;
  }
  return {
    last_success: success ? text(success.event) : null,
    last_success_at: success ? text(success.at) : null,
    last_error: failure ? text(failure.errorCode || failure.event) : null,
    last_error_at: failure ? text(failure.at) : null,
  };
}

const compact = (object) => {
  const out = {};
  for (const [key, value] of Object.entries(object)) if (value !== null && value !== undefined) out[key] = value;
  return Object.keys(out).length ? out : null;
};

export function buildReportSnapshot({
  now = Date.now(),
  surface,
  menu,
  online,
  hydration = {},
  outbox = null,
  journal = [],
  storage = {},
  quest = null,
  attempt = null,
  board = null,
} = {}) {
  const pending = (name) => count(outbox?.[name]);
  const snapshot = {
    taken_at: new Date(now).toISOString(),
    surface: text(surface),
    menu: text(menu),
    online: online !== false,
    sync: compact({
      hydration: text(hydration.state),
      hydration_error: text(hydration.error),
      outbox_state: text(outbox?.state),
      pending_canonical: pending('canonical'),
      pending_legacy: pending('legacy'),
      pending_wallet: pending('wallet'),
      ...journalMilestones(journal),
    }),
    storage: compact({ ratio: count(storage.ratio), error: text(storage.error) }),
  };
  if (quest?.id) {
    snapshot.quest = compact({
      id: text(quest.id),
      adventure: text(quest.adventure),
      ordinal: count(quest.ordinal),
    });
    if (attempt) {
      const help = attempt.helpUses && typeof attempt.helpUses === 'object' ? attempt.helpUses : {};
      snapshot.attempt = compact({
        state: text(attempt.state),
        mode: text(attempt.mode),
        elapsed_s: count(Math.floor((Number(attempt.activeDuration) || 0) / 1000)),
        qualifying: typeof attempt.qualifying === 'boolean' ? attempt.qualifying : null,
        assistance: typeof attempt.assistanceUsed === 'boolean' ? attempt.assistanceUsed : null,
        mistake: typeof attempt.mistakeCommitted === 'boolean' ? attempt.mistakeCommitted : null,
        resets: count(attempt.resetCount),
        ...Object.fromEntries(
          Object.entries(help)
            .filter(([kind, value]) => /^[a-z][a-z0-9_]{0,20}$/.test(kind) && count(value) !== null)
            .slice(0, 6)
            .map(([kind, value]) => ['help_' + kind, count(value)]),
        ),
      });
    }
    const encoded = encodeBoard(board);
    if (encoded) snapshot.board = encoded;
  }
  for (const key of Object.keys(snapshot)) if (snapshot[key] === null) delete snapshot[key];
  return snapshot;
}
