// #1020: « Mes signalements » — a player's own reports, the answers of the Lumen
// team and one complementary reply per message, limited to that report (no general
// messaging). Reads happen on demand: one summary when Mon espace is opened (at most
// every 10 minutes per identity) and the full list when the dialog is opened, which
// also marks the answers shown as read. No polling, no Realtime, no email.
// Guests read on the sending device only, through the secret draft references.
import { readSentRefs } from './beta-feedback.js';

export const REPORT_STATUS_KEYS = Object.freeze({
  new: 'reports.status.new',
  reviewed: 'reports.status.reviewed',
  answered: 'reports.status.answered',
  fixed: 'reports.status.closed',
  closed: 'reports.status.closed',
});
const KIND_KEYS = { bug: 'reports.kind.bug', question: 'reports.kind.question', idea: 'reports.kind.idea' };
const SUMMARY_MS = 10 * 60e3;

export function reportStatusKey(status) {
  return REPORT_STATUS_KEYS[status] || 'reports.status.new';
}

export function newMessageRef() {
  try {
    return 'm' + globalThis.crypto.randomUUID().replace(/-/g, '');
  } catch {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
}

export function createMyReports({
  document,
  storage,
  t,
  rpc,
  identity,
  now = () => Date.now(),
  locale = () => document.documentElement.lang || 'fr',
  onOpen = () => {},
  onClose = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  const modal = $('myReportsModal'),
    list = $('myReportsList'),
    status = $('myReportsStatus'),
    button = $('myReportsBtn'),
    badge = $('myReportsBadge');
  if (!modal || !list) return { open() {}, check() {}, noteSent() {}, close() {} };
  let lastSummary = { key: null, at: -Infinity },
    loading = false,
    opener = null,
    generation = 0;
  const drafts = new Map();
  const args = () => {
    const who = identity() || {};
    return {
      who,
      key: (who.userId || 'guest') + ':' + (who.anonymousId || ''),
      params: { p_anonymous_id: who.anonymousId || null, p_refs: readSentRefs(storage) },
    };
  };
  const visible = (who) => !!who.userId || readSentRefs(storage).length > 0;
  function setBadge(count) {
    if (!badge) return;
    badge.hidden = !(count > 0);
    badge.textContent = count > 0 ? String(Math.min(count, 9)) : '';
    badge.setAttribute('aria-label', count > 0 ? t('reports.unread', { count }) : '');
    document.getElementById('mobileAccount')?.toggleAttribute('data-reports-unread', count > 0);
  }
  function renderButton() {
    if (button) button.hidden = !visible(args().who);
  }
  // Called when Mon espace opens (and once after sign-in): count only.
  async function check({ force = false } = {}) {
    const { who, key, params } = args();
    renderButton();
    if (!visible(who) || !who.client) return;
    if (!force && lastSummary.key === key && now() - lastSummary.at < SUMMARY_MS) return;
    lastSummary = { key, at: now() };
    try {
      const { data, error } = await rpc('lumen_my_feedback', { ...params, p_summary: true });
      if (!error && args().key === key) setBadge(Number(data?.unread) || 0);
    } catch {
      /* the badge simply stays as it was */
    }
  }
  function noteSent() {
    renderButton();
    lastSummary = { key: null, at: -Infinity };
  }
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const date = (value) => {
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp)) return el('span', '', '—');
    const node = el('time', '', new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'short' }).format(stamp));
    node.dateTime = new Date(stamp).toISOString();
    return node;
  };
  function renderItem(item) {
    const li = el('li', 'my-report');
    li.dataset.status = item.status;
    const body = el('div', 'my-report-body');
    body.hidden = true;
    const head = el('button', 'my-report-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    const chip = el('span', 'my-report-status', t(reportStatusKey(item.status)));
    head.append(el('span', 'my-report-kind', t(KIND_KEYS[item.kind] || 'reports.kind.bug')), ' · ', date(item.created_at), ' ', chip);
    if (item.unread) head.append(' ', el('span', 'my-report-new', t('reports.new')));
    head.onclick = () => {
      body.hidden = !body.hidden;
      head.setAttribute('aria-expanded', String(!body.hidden));
    };
    body.append(el('p', 'my-report-message', item.message || ''));
    const thread = el('ol', 'my-report-thread');
    for (const message of Array.isArray(item.thread) ? item.thread : []) {
      const entry = el('li', 'my-report-msg');
      entry.dataset.by = message.by === 'admin' ? 'admin' : 'player';
      const who = el('strong', '', t(message.by === 'admin' ? 'reports.team' : 'reports.you'));
      entry.append(who, ' · ', date(message.at), el('p', '', message.body || ''));
      thread.append(entry);
    }
    body.append(thread);
    // One complementary reply, kept while the dialog lives; same reference on retry.
    const form = el('form', 'my-report-reply');
    const label = el('label', 'visually-hidden', t('reports.replyLabel'));
    const area = el('textarea');
    area.maxLength = 2000;
    area.rows = 2;
    area.placeholder = t('reports.replyPlaceholder');
    area.id = 'myReportReply' + item.id;
    label.htmlFor = area.id;
    const draft = drafts.get(item.id) || { body: '', ref: newMessageRef() };
    area.value = draft.body;
    area.oninput = () => drafts.set(item.id, { ...draft, body: area.value });
    const send = el('button', 'primary', t('reports.replySend'));
    send.type = 'submit';
    const note = el('p', 'beta-status');
    note.setAttribute('role', 'status');
    form.append(label, area, send, note);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const text = area.value.trim();
      if (text.length < 2 || send.disabled) return;
      const current = drafts.get(item.id) || draft;
      send.disabled = true;
      note.textContent = t('reports.replySending');
      try {
        const { params } = args();
        const { error } = await rpc('lumen_feedback_reply', {
          p_id: item.id,
          p_body: text,
          p_message_ref: current.ref,
          ...params,
        });
        if (error) throw Error(error.message || 'failed');
        drafts.delete(item.id);
        note.textContent = t('reports.replyDone');
        const entry = el('li', 'my-report-msg');
        entry.dataset.by = 'player';
        entry.append(el('strong', '', t('reports.you')), ' · ', date(new Date(now()).toISOString()), el('p', '', text));
        thread.append(entry);
        area.value = '';
        chip.textContent = t('reports.status.reviewed');
        li.dataset.status = 'reviewed';
        drafts.set(item.id, { body: '', ref: newMessageRef() });
      } catch (error) {
        note.textContent = t(/rate_limited/.test(String(error?.message)) ? 'reports.replyLimit' : 'reports.replyError');
      } finally {
        send.disabled = false;
      }
    };
    body.append(form);
    li.append(head, body);
    return li;
  }
  async function load() {
    const { who, key, params } = args();
    const mine = ++generation;
    list.replaceChildren();
    const guestNote = $('myReportsGuest');
    if (guestNote) guestNote.hidden = !!who.userId;
    if (!who.client || document.defaultView?.navigator?.onLine === false) {
      status.textContent = t('reports.offline');
      return;
    }
    loading = true;
    status.textContent = t('reports.loading');
    try {
      const { data, error } = await rpc('lumen_my_feedback', { ...params, p_mark_read: true });
      if (mine !== generation || args().key !== key) return;
      if (error) throw Error(error.message);
      const items = Array.isArray(data?.items) ? data.items : [];
      status.textContent = items.length ? '' : t('reports.empty');
      list.replaceChildren(...items.map(renderItem));
      const first = list.querySelector('.my-report-new')?.closest('.my-report')?.querySelector('.my-report-head');
      first?.click();
      setBadge(0);
      lastSummary = { key, at: now() };
    } catch {
      if (mine === generation) status.textContent = t('reports.error');
    } finally {
      loading = false;
    }
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    generation++;
    onClose();
    (opener?.isConnected && !opener.closest('[hidden]') ? opener : $('mobileAccount'))?.focus?.();
  }
  function open({ origin } = {}) {
    opener = origin || document.activeElement;
    modal.hidden = false;
    onOpen();
    $('myReportsClose')?.focus();
    void load();
  }
  $('myReportsClose')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });
  renderButton();
  return { open, close, check, noteSent, get loading() { return loading; } };
}
