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

export function newClientRef() {
  const random = () => Math.random().toString(36).slice(2, 10);
  return ('r' + Date.now().toString(36) + random() + random())
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 40);
}

export function readDraft(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
    if (!draft || !FEEDBACK_KINDS.includes(draft.kind) || typeof draft.message !== 'string')
      return null;
    return {
      kind: draft.kind,
      message: draft.message.slice(0, 2000),
      ref: /^[A-Za-z0-9]{8,64}$/.test(draft.ref || '') ? draft.ref : newClientRef(),
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

// UI controller. `send(payload)` returns the server receipt or throws.
export function createBetaFeedback({
  document,
  storage,
  t,
  send,
  context,
  journal = () => [],
  fullCopy = null,
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
    sending = false,
    opener = null;
  const kindInputs = () => [...form.querySelectorAll('input[name="feedbackKind"]')];
  function renderKind() {
    for (const input of kindInputs()) input.checked = input.value === draft.kind;
    text.placeholder = t(PLACEHOLDER_KEYS[draft.kind]);
  }
  function renderContext() {
    const list = $('feedbackContextList');
    if (!list) return;
    const ctx = context(extra);
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
      // #1010: the sync journal goes with the report; no separate diagnostic step.
      journal().length
        ? [t('feedback.ctx.journal'), t('feedback.ctx.journalCount', { count: journal().length })]
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
  // #959: the single help entry. A signed-in player may attach the full account
  // copy (former « Transmettre mon diagnostic »); its consent text is shown when
  // ticked and it is sent only after the report, through the assistance session.
  function renderFullCopy() {
    const row = $('feedbackFullCopyRow'),
      box = $('feedbackFullCopy'),
      note = $('feedbackFullCopyNote');
    if (!row || !box) return;
    const available = !!fullCopy?.available();
    row.hidden = !available;
    if (!available) box.checked = false;
    if (note) note.hidden = !box.checked;
  }
  function open({ kind, surface, errorCode, origin } = {}) {
    opener = origin || document.activeElement;
    extra = { surface, errorCode };
    if (kind && FEEDBACK_KINDS.includes(kind) && !draft.message.trim()) draft.kind = kind;
    form.hidden = false;
    if (done) done.hidden = true;
    text.value = draft.message;
    renderKind();
    renderContext();
    const box = $('feedbackFullCopy');
    if (box) box.checked = !!fullCopy?.available() && !!fullCopy?.suggested();
    renderFullCopy();
    const fullStatus = $('feedbackFullCopyStatus');
    if (fullStatus) {
      fullStatus.textContent = '';
      fullStatus.hidden = true;
    }
    setStatus(draft.message.trim() ? 'feedback.draftRestored' : '');
    button.disabled = false;
    modal.hidden = false;
    onOpen();
    text.focus();
  }
  form.addEventListener('change', (event) => {
    if (event.target.id === 'feedbackFullCopy') return renderFullCopy();
    if (event.target.name !== 'feedbackKind') return;
    draft.kind = event.target.value;
    renderKind();
    saveDraft(storage, draft);
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
      withFullCopy = !!$('feedbackFullCopy')?.checked && !!fullCopy?.available();
    if (message.length < 3) {
      setStatus('feedback.error.messageRequired');
      text.focus();
      return;
    }
    sending = true;
    button.disabled = true;
    setStatus('feedback.sending');
    try {
      const receipt = await send({
        kind: draft.kind,
        message,
        context: context(extra),
        clientRef: draft.ref,
        journal: journal(),
      });
      clearDraft(storage);
      draft = { kind: 'bug', message: '', ref: newClientRef() };
      text.value = '';
      setStatus('');
      form.hidden = true;
      if (done) {
        done.hidden = false;
        const receiptText = $('feedbackReceipt');
        if (receiptText)
          receiptText.textContent = t('feedback.receipt', { id: String(receipt?.id ?? '—') }); // an id, never grouped like a number;
        $('feedbackDoneClose')?.focus();
      }
      onSent(receipt);
      // The report is already confirmed; the full copy reports its own status.
      if (withFullCopy) void fullCopy.send();
    } catch (error) {
      // The draft (and its reference) stays: a retry never creates a duplicate.
      setStatus(ERROR_KEYS[classifyFeedbackError(error, document.defaultView?.navigator?.onLine)]);
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
  return { open, close, refresh: () => (modal.hidden ? null : (renderKind(), renderContext())) };
}
