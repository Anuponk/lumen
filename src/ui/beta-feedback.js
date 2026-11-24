// #960: report a bug, ask a question or suggest something from anywhere in Lumen.
// Reuses the existing beta modal (#feedbackModal) and server table; v2 adds a
// receipt, idempotent retries, a rate limit and an allowlisted technical context.
// The board is never touched: the modal pauses the attempt like any menu (#925).

export const FEEDBACK_KINDS = Object.freeze(['bug', 'question', 'idea']);
const DRAFT_KEY = 'lumenFeedbackDraftV1';
const PLACEHOLDER_KEYS = Object.freeze({
  bug: 'feedback.placeholder.bug',
  question: 'feedback.placeholder.question',
  idea: 'feedback.placeholder.idea',
});
const ERROR_KEYS = Object.freeze({
  offline: 'feedback.error.offline',
  rateLimited: 'feedback.error.rateLimited',
  messageRequired: 'feedback.error.messageRequired',
  failed: 'feedback.error.failed',
});
const SESSION_KEY = 'lumenFeedbackSessionV1';

// Non-sensitive correlation id for this tab only (never the account or device id).
export function feedbackSessionId(storage) {
  try {
    let id = storage.getItem(SESSION_KEY);
    if (!/^s-[a-z0-9]{8}$/.test(id || '')) {
      id = 's-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
      storage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function browserFamily(userAgent = '') {
  const ua = String(userAgent);
  const android = /Android/i.test(ua),
    ios = /iPhone|iPad|iPod/i.test(ua);
  const name = /EdgA?\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser\//.test(ua)
      ? 'Samsung'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /CriOS\/|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Other';
  return name + (android ? ' · Android' : ios ? ' · iOS' : '');
}

// Only what helps reproduce a problem; the server applies the same allowlist.
export function buildFeedbackContext({
  appVersion,
  locale,
  platform,
  userAgent,
  screen,
  standalone,
  online,
  quest,
  adventure,
  surface,
  errorCode,
  sessionId,
  androidVersion,
}) {
  const context = {
    app_version: appVersion || 'unknown',
    platform: platform || 'web',
    browser: browserFamily(userAgent),
    screen: screen || null,
    locale: locale || null,
    standalone: !!standalone,
    offline: online === false,
    surface: surface || 'menu',
    session_id: sessionId || null,
  };
  if (androidVersion) context.android_version = String(androidVersion);
  if (quest?.id) {
    context.quest_id = String(quest.id);
    if (Number.isFinite(quest.ordinal)) context.quest_ordinal = quest.ordinal;
    if (Number.isFinite(quest.puzzleId)) context.puzzle_id = quest.puzzleId;
    context.in_quest = !!quest.inProgress;
  }
  if (adventure) context.adventure = String(adventure);
  if (errorCode) context.error_code = String(errorCode).slice(0, 64);
  for (const key of Object.keys(context)) if (context[key] === null) delete context[key];
  return context;
}

export function classifyFeedbackError(error, online = true) {
  const text = String(error?.message || error || '');
  if (
    online === false ||
    /Failed to fetch|NetworkError|network|timeout|offline|Load failed/i.test(text)
  )
    return 'offline';
  if (/rate_limited/.test(text)) return 'rateLimited';
  if (/message_required/.test(text)) return 'messageRequired';
  return 'failed';
}

// #1020: the reference is also the secret that lets a guest read the answer on
// this device, so it comes from the cryptographic generator when available.
export function newClientRef() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  try {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
    return 'r' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  } catch {
    const random = () => Math.random().toString(36).slice(2, 10);
    return ('r' + Date.now().toString(36) + random() + random() + random())
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 40);
  }
}

export function readDraft(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
    if (!draft || !FEEDBACK_KINDS.includes(draft.kind) || typeof draft.message !== 'string')
      return null;
    const snapshot =
      draft.snapshot &&
      typeof draft.snapshot === 'object' &&
      JSON.stringify(draft.snapshot).length <= 8192
        ? draft.snapshot
        : null;
    return {
      kind: draft.kind,
      message: draft.message.slice(0, 2000),
      ref: /^[A-Za-z0-9]{8,64}$/.test(draft.ref || '') ? draft.ref : newClientRef(),
      // #960: a report waiting for the network keeps the moment it was made.
      ...(draft.queued === true ? { queued: true } : {}),
      ...(snapshot ? { snapshot } : {}),
    };
  } catch {
    return null;
  }
}
export function saveDraft(storage, draft) {
  try {
    if (!draft.message.trim()) storage.removeItem(DRAFT_KEY);
    else storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {}
}
export function clearDraft(storage) {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {}
}

// #1020: the references of the reports sent from this device (at most 20). For a
// guest they are the only way to read an answer; nothing else identifies them.
export const SENT_REFS_KEY = 'lumenFeedbackRefsV1';
export function readSentRefs(storage) {
  try {
    const list = JSON.parse(storage.getItem(SENT_REFS_KEY) || '[]');
    return Array.isArray(list)
      ? list.filter((r) => typeof r === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(r)).slice(-20)
      : [];
  } catch {
    return [];
  }
}
export function rememberSentRef(storage, ref) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(ref || '')) return;
  try {
    const list = readSentRefs(storage).filter((r) => r !== ref);
    storage.setItem(SENT_REFS_KEY, JSON.stringify([...list, ref].slice(-20)));
  } catch {}
}

// UI controller. `send(payload)` returns the server receipt or throws.
// Bugs: the minimal diagnostic (context, sync journal, snapshot of this moment)
// needs the explicit « Envoyer les données nécessaires au diagnostic » box; the
// complete account copy is a second, never pre-ticked option for signed-in players.
// Questions and suggestions carry the basic context only.
export function createBetaFeedback({
  document,
  storage,
  t,
  send,
  context,
  journal = () => [],
  snapshot = () => null,
  guest = () => false,
  fullCopy = null,
  window: win = document.defaultView,
  onSent = () => {},
  onOpen = () => {},
  onClose = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  const modal = $('feedbackModal'),
    form = $('feedbackForm'),
    text = $('feedbackText'),
    status = $('feedbackStatus'),
    button = $('feedbackSend'),
    done = $('feedbackDone');
  if (!modal || !form || !text) return { open() {} };
  let draft = readDraft(storage) || { kind: 'bug', message: '', ref: newClientRef() };
  let extra = {},
    moment = null,
    sending = false,
    opener = null,
    waiting = false;
  const kindInputs = () => [...form.querySelectorAll('input[name="feedbackKind"]')];
  const diagnosticChecked = () => !!$('feedbackDiagnostic')?.checked;
  function renderFullCopy() {
    const row = $('feedbackFullCopyRow'),
      box = $('feedbackFullCopy'),
      note = $('feedbackFullCopyNote');
    if (!row || !box) return;
    const available = draft.kind === 'bug' && diagnosticChecked() && !!fullCopy?.available();
    row.hidden = !available;
    if (!available) box.checked = false;
    if (note) note.hidden = !box.checked;
  }
  function renderKind() {
    for (const input of kindInputs()) input.checked = input.value === draft.kind;
    text.placeholder = t(PLACEHOLDER_KEYS[draft.kind]);
    const row = $('feedbackDiagnosticRow');
    if (row) row.hidden = draft.kind !== 'bug';
    renderFullCopy();
  }
  function renderContext() {
    const list = $('feedbackContextList');
    if (!list) return;
    const ctx = context(extra);
    const bug = draft.kind === 'bug';
    const rows = [
      [
        t('feedback.ctx.version'),
        ctx.app_version + (ctx.android_version ? ' · Android ' + ctx.android_version : ''),
      ],
      [
        t('feedback.ctx.device'),
        ctx.browser +
          ' · ' +
          (ctx.screen || '?') +
          (ctx.standalone ? ' · ' + t('feedback.ctx.installed') : ''),
      ],
      ctx.quest_ordinal
        ? [
            t('feedback.ctx.quest'),
            (ctx.adventure ? ctx.adventure + ' · ' : '') +
              t('feedback.ctx.questNumber', { quest: ctx.quest_ordinal }),
          ]
        : null,
      ctx.error_code ? [t('feedback.ctx.error'), ctx.error_code] : null,
      ctx.session_id ? [t('feedback.ctx.session'), ctx.session_id] : null,
      // Bugs only: the sync journal and the state of this moment (board, sync).
      bug && journal().length
        ? [t('feedback.ctx.journal'), t('feedback.ctx.journalCount', { count: journal().length })]
        : null,
      bug && moment
        ? [
            t('feedback.ctx.snapshot'),
            t(moment.board ? 'feedback.ctx.snapshotBoard' : 'feedback.ctx.snapshotSync'),
          ]
        : null,
    ].filter(Boolean);
    list.replaceChildren(
      ...rows.map(([label, value]) => {
        const item = document.createElement('li'),
          strong = document.createElement('strong');
        strong.textContent = label + ' : ';
        item.append(strong, String(value));
        return item;
      }),
    );
  }
  function setStatus(key, params) {
    status.textContent = key ? t(key, params) : '';
    status.dataset.state = key ? key.split('.').pop() : '';
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    onClose();
    (opener?.isConnected && !opener.closest('[hidden]')
      ? opener
      : document.getElementById('mobileAccount')
    )?.focus?.();
  }
  function open({ kind, surface, errorCode, origin } = {}) {
    opener = origin || document.activeElement;
    extra = { surface, errorCode };
    // #960: the state is taken now, before the form changes what is on screen.
    try {
      moment = snapshot({ surface }) || null;
    } catch {
      moment = null;
    }
    if (kind && FEEDBACK_KINDS.includes(kind) && !draft.message.trim()) draft.kind = kind;
    form.hidden = false;
    if (done) done.hidden = true;
    text.value = draft.message;
    const diagnostic = $('feedbackDiagnostic');
    if (diagnostic) diagnostic.checked = false;
    const box = $('feedbackFullCopy');
    if (box) box.checked = false;
    const guestNote = $('feedbackGuestNote');
    if (guestNote) guestNote.hidden = !guest();
    renderKind();
    renderContext();
    const fullStatus = $('feedbackFullCopyStatus');
    if (fullStatus) {
      fullStatus.textContent = '';
      fullStatus.hidden = true;
    }
    setStatus(
      draft.queued ? 'feedback.queued' : draft.message.trim() ? 'feedback.draftRestored' : '',
    );
    button.disabled = false;
    modal.hidden = false;
    onOpen();
    text.focus();
  }
  function payload(kind, message, ref, snap) {
    const bug = kind === 'bug';
    return {
      kind,
      message,
      context: context(extra),
      clientRef: ref,
      journal: bug ? journal() : [],
      snapshot: bug ? snap : null,
    };
  }
  function finish(receipt, ref, { background = false } = {}) {
    rememberSentRef(storage, ref);
    clearDraft(storage);
    draft = { kind: 'bug', message: '', ref: newClientRef() };
    onSent(receipt, { background });
  }
  // #960: offline, the report (with its moment) waits for the network; one silent
  // retry happens on reconnection. Success is announced only with a server receipt.
  function queue(snap) {
    draft.queued = true;
    if (snap) draft.snapshot = snap;
    saveDraft(storage, draft);
    if (waiting || !win?.addEventListener) return;
    waiting = true;
    win.addEventListener(
      'online',
      async () => {
        waiting = false;
        const pending = readDraft(storage);
        if (!pending?.queued || sending) return;
        sending = true;
        try {
          const receipt = await send(
            payload(pending.kind, pending.message.trim(), pending.ref, pending.snapshot || null),
          );
          finish(receipt, pending.ref, { background: true });
          if (!modal.hidden && !form.hidden) {
            text.value = '';
            setStatus('');
          }
        } catch {
          /* stays queued: the next opening shows it and the player can send again */
        } finally {
          sending = false;
        }
      },
      { once: true },
    );
  }
  form.addEventListener('change', (event) => {
    if (event.target.id === 'feedbackFullCopy') return renderFullCopy();
    if (event.target.id === 'feedbackDiagnostic') {
      if (status.dataset.state === 'diagnosticRequired') setStatus('');
      return renderFullCopy();
    }
    if (event.target.name !== 'feedbackKind') return;
    draft.kind = event.target.value;
    if (status.dataset.state === 'diagnosticRequired') setStatus('');
    renderKind();
    renderContext();
    saveDraft(storage, draft);
  });
  // The complete copy can be checked before it is sent (built on this device only).
  $('feedbackFullCopyPreview')?.addEventListener('toggle', (event) => {
    const pre = $('feedbackFullCopyPreviewText');
    if (!event.target.open || !pre) return;
    let value = null;
    try {
      value = fullCopy?.preview?.() ?? null;
    } catch {}
    pre.textContent = value
      ? JSON.stringify(value, null, 1)
      : t('feedback.fullCopyPreviewUnavailable');
  });
  text.addEventListener('input', () => {
    draft.message = text.value;
    saveDraft(storage, draft);
    if (status.dataset.state === 'messageRequired') setStatus('');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    const message = text.value.trim(),
      kind = draft.kind,
      ref = draft.ref,
      withFullCopy = kind === 'bug' && !!$('feedbackFullCopy')?.checked && !!fullCopy?.available();
    if (message.length < 3) {
      setStatus('feedback.error.messageRequired');
      text.focus();
      return;
    }
    if (kind === 'bug' && !diagnosticChecked()) {
      setStatus('feedback.error.diagnosticRequired');
      $('feedbackDiagnostic')?.focus();
      return;
    }
    sending = true;
    button.disabled = true;
    setStatus('feedback.sending');
    const snap = draft.snapshot || moment;
    try {
      // The full copy's dossier is activated first, so the report can reference it.
      let copy = null;
      if (withFullCopy) {
        try {
          copy = (await fullCopy.prepare()) || null;
        } catch {
          copy = null;
        }
      }
      const receipt = await send({ ...payload(kind, message, ref, snap), support: copy });
      finish(receipt, ref);
      text.value = '';
      setStatus('');
      form.hidden = true;
      if (done) {
        done.hidden = false;
        const receiptText = $('feedbackReceipt');
        if (receiptText)
          receiptText.textContent = t('feedback.receipt', { id: String(receipt?.id ?? '—') }); // an id, never grouped like a number
        const guestDone = $('feedbackDoneGuest');
        if (guestDone) guestDone.hidden = !guest();
        $('feedbackDoneClose')?.focus();
      }
      // The report is already confirmed; the full copy reports its own status.
      if (withFullCopy) void fullCopy.send(copy);
    } catch (error) {
      // The draft (and its reference) stays: a retry never creates a duplicate.
      const kindOfError = classifyFeedbackError(error, win?.navigator?.onLine);
      if (kindOfError === 'offline') {
        queue(snap);
        setStatus('feedback.queued');
      } else setStatus(ERROR_KEYS[kindOfError]);
      button.disabled = false;
    } finally {
      sending = false;
    }
  });
  $('feedbackCancel')?.addEventListener('click', close);
  $('feedbackDoneClose')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });
  // A report left waiting from a previous session tries again once online.
  if (draft.queued) queue(draft.snapshot || null);
  return {
    open,
    close,
    refresh: () => (modal.hidden ? null : (renderKind(), renderContext())),
  };
}
