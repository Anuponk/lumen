// #1020/#960: the administrators' inbox of player reports, inside /admin/analytics.
// The list is paged (30, keyset) and carries no journal, snapshot or capture; one
// report's linked data (journal, snapshot of the moment, capture state, exchange) is
// read only when it is opened. Answers are idempotent (one reference per draft) and
// a failed send keeps the draft. Every DOM text is set with textContent.
import { createTranslator } from './i18n.js';
const defaultT = createTranslator().t;
const STATUS = { new: 'new', reviewed: 'reviewed', answered: 'answered', fixed: 'closed', closed: 'closed' };
const STATUS_KEYS = { new: 'admin.inbox.status.new', reviewed: 'admin.inbox.status.reviewed', answered: 'admin.inbox.status.answered', closed: 'admin.inbox.status.closed' };
const KIND_KEYS = { bug: 'admin.inbox.kind.bug', question: 'admin.inbox.kind.question', idea: 'admin.inbox.kind.idea', rule: 'admin.inbox.kind.rule', difficulty: 'admin.inbox.kind.difficulty', other: 'admin.inbox.kind.other' };
const FILTER_KEYS = { action: 'admin.inbox.filter.action', all: 'admin.inbox.filter.all', new: 'admin.inbox.filter.new', reviewed: 'admin.inbox.filter.reviewed', answered: 'admin.inbox.filter.answered', closed: 'admin.inbox.filter.closed' };
const CATEGORY_KEYS = { all: 'admin.inbox.category.all', bug: 'admin.inbox.category.bug', question: 'admin.inbox.category.question', idea: 'admin.inbox.category.idea', other: 'admin.inbox.category.other' };
const CAPTURE_KEYS = { none: 'admin.inbox.capture.none', pending: 'admin.inbox.capture.pending', received: 'admin.inbox.capture.received', failed: 'admin.inbox.capture.failed', expired: 'admin.inbox.capture.expired', deleted: 'admin.inbox.capture.deleted' };
const DOMAIN_KEYS = { canonical: 'admin.inbox.snapshot.domain.canonical', legacy: 'admin.inbox.snapshot.domain.legacy', wallet: 'admin.inbox.snapshot.domain.wallet' };
export const inboxStatusLabel = (status, t = defaultT) => (STATUS[status] ? t(STATUS_KEYS[STATUS[status]]) : status);
const el = (doc, tag, text, className) => {
  const node = doc.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const newRef = () => {
  try {
    return 'a' + globalThis.crypto.randomUUID().replace(/-/g, '');
  } catch {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
};
const whenWith = (t) => (value) => {
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toLocaleString(t('admin.dateLocale')) : '—';
};

// Readable synthesis of the snapshot before any raw detail.
export function snapshotSummary(snapshot, t = defaultT) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const when = whenWith(t);
  const lines = [];
  if (snapshot.taken_at) lines.push([t('admin.inbox.snapshot.moment'), when(snapshot.taken_at)]);
  if (snapshot.surface || snapshot.menu) lines.push([t('admin.inbox.snapshot.screen'), [snapshot.surface, snapshot.menu].filter(Boolean).join(' · ')]);
  lines.push([t('admin.inbox.snapshot.connection'), snapshot.online === false ? t('admin.inbox.snapshot.offline') : t('admin.inbox.snapshot.online')]);
  const sync = snapshot.sync || {};
  if (sync.hydration) lines.push([t('admin.inbox.snapshot.profile'), sync.hydration + (sync.hydration_error ? ' (' + sync.hydration_error + ')' : '')]);
  const pending = ['canonical', 'legacy', 'wallet'].filter((d) => Number.isFinite(sync['pending_' + d]));
  if (pending.length) lines.push([t('admin.inbox.snapshot.pending'), pending.map((d) => t(DOMAIN_KEYS[d]) + ' ' + sync['pending_' + d]).join(' · ')]);
  if (sync.last_success) lines.push([t('admin.inbox.snapshot.lastSuccess'), sync.last_success + ' · ' + when(sync.last_success_at)]);
  if (sync.last_error) lines.push([t('admin.inbox.snapshot.lastError'), sync.last_error + ' · ' + when(sync.last_error_at)]);
  if (snapshot.storage) lines.push([t('admin.inbox.snapshot.storage'), [snapshot.storage.ratio !== undefined ? snapshot.storage.ratio + ' %' : null, snapshot.storage.error].filter(Boolean).join(' · ') || '—']);
  if (snapshot.quest) lines.push([t('admin.inbox.snapshot.quest'), [snapshot.quest.adventure, snapshot.quest.ordinal ? 'Q' + snapshot.quest.ordinal : null, snapshot.quest.id].filter(Boolean).join(' · ')]);
  if (snapshot.attempt) {
    const a = snapshot.attempt;
    const helps = Object.entries(a).filter(([key]) => key.startsWith('help_')).map(([key, v]) => key.slice(5) + ' ' + v);
    lines.push([t('admin.inbox.snapshot.attempt'), [a.state, a.mode, Number.isFinite(a.elapsed_s) ? a.elapsed_s + ' s' : null, a.qualifying ? t('admin.inbox.snapshot.qualifying') : null, a.assistance ? t('admin.inbox.snapshot.assistance') : null, a.mistake ? t('admin.inbox.snapshot.mistake') : null, a.resets ? t('admin.inbox.snapshot.resets', { count: a.resets }) : null, ...helps].filter(Boolean).join(' · ')]);
  }
  return lines;
}

// Board digits: 0 empty, 1 cross, 2 guardian, 3 automatic cross.
export function boardText(board) {
  if (typeof board !== 'string' || !/^[0-9/]+$/.test(board)) return '';
  return board
    .split('/')
    .map((row) => [...row].map((c) => ({ 0: '·', 1: '×', 2: '◆', 3: '∘' })[c] || c).join(' '))
    .join('\n');
}

export function mountFeedbackInbox(host, { rpc, authorized, days = () => 30, onPlayer = () => {}, onDossier = null, t = defaultT }) {
  if (!host) return { load() {}, filterPlayer() {} };
  const doc = host.ownerDocument,
    when = whenWith(t);
  const kindLabel = (kind) => (KIND_KEYS[kind] ? t(KIND_KEYS[kind]) : kind);
  const state = { status: 'action', kind: '', player: null, playerLabel: '', items: [], next: null, counts: null, request: 0 };
  const cache = new Map();
  host.replaceChildren();
  const filters = el(doc, 'div', null, 'admin-inbox-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', t('admin.inbox.filterLabel'));
  const chips = ['action', 'all', 'new', 'reviewed', 'answered', 'closed'].map((value) => {
    const chip = el(doc, 'button', t(FILTER_KEYS[value]));
    chip.type = 'button';
    chip.dataset.inboxStatus = value;
    chip.onclick = () => {
      state.status = value;
      void load();
    };
    filters.append(chip);
    return [value, chip];
  });
  const kind = el(doc, 'select');
  kind.setAttribute('aria-label', t('admin.inbox.categoryLabel'));
  for (const value of ['', 'bug', 'question', 'idea', 'other']) {
    const option = el(doc, 'option', t(CATEGORY_KEYS[value || 'all']));
    option.value = value;
    kind.append(option);
  }
  kind.onchange = () => {
    state.kind = kind.value;
    void load();
  };
  const player = el(doc, 'button', '', 'admin-inbox-player');
  player.type = 'button';
  player.hidden = true;
  player.onclick = () => filterPlayer(null);
  filters.append(kind, player);
  const status = el(doc, 'p', '', 'admin-cockpit-status');
  status.setAttribute('role', 'status');
  const list = el(doc, 'div', null, 'admin-inbox-list');
  const more = el(doc, 'button', t('admin.inbox.older'));
  more.type = 'button';
  more.hidden = true;
  more.onclick = () => load({ append: true });
  host.append(filters, status, list, more);

  function renderChips() {
    for (const [value, chip] of chips) {
      const n = state.counts ? (value === 'all' ? state.counts.all : state.counts[value]) : null;
      chip.textContent = t(FILTER_KEYS[value]) + (Number.isFinite(n) ? ' ' + n : '');
      chip.setAttribute('aria-pressed', String(state.status === value));
    }
    player.hidden = !state.player;
    player.textContent = state.player ? t('admin.inbox.playerFilter', { name: state.playerLabel }) : '';
    player.setAttribute('aria-label', t('admin.inbox.playerFilterClear', { name: state.playerLabel }));
  }
  async function load({ append = false } = {}) {
    if (!authorized()) return;
    const request = ++state.request;
    if (!append) {
      state.items = [];
      state.next = null;
      list.replaceChildren();
    }
    status.textContent = t('admin.inbox.loading');
    more.hidden = true;
    let result;
    try {
      result = await rpc('lumen_admin_feedback_inbox', {
        p_days: days(),
        p_status: state.status === 'all' ? null : state.status,
        p_kind: state.kind || null,
        p_player: state.player,
        p_before: append ? state.next : null,
        p_limit: 30,
      });
    } catch {
      result = { error: true };
    }
    if (request !== state.request || !authorized()) return;
    if (result.error) {
      status.textContent = t('admin.inbox.unavailable');
      return;
    }
    const data = result.data || {};
    state.counts = data.counts || null;
    const items = Array.isArray(data.items) ? data.items : [];
    state.items.push(...items);
    state.next = data.next_before ?? null;
    for (const item of items) list.append(row(item));
    status.textContent = state.items.length ? '' : t('admin.inbox.empty');
    more.hidden = !state.next;
    renderChips();
  }
  function filterPlayer(key, label = '') {
    state.player = key || null;
    state.playerLabel = label || '';
    if (key) state.status = 'all';
    return load();
  }
  function row(item) {
    const card = el(doc, 'details', null, 'admin-inbox-item');
    card.dataset.feedbackId = item.id;
    card.dataset.status = item.status;
    const summary = el(doc, 'summary');
    const title = el(doc, 'strong', t('admin.inbox.title', { id: item.id, kind: kindLabel(item.kind), name: item.player_label || t('admin.inbox.player') }));
    const badge = el(doc, 'span', inboxStatusLabel(item.status, t), 'admin-inbox-status');
    summary.append(title, ' ', badge);
    if (item.needs_action) summary.append(' ', el(doc, 'span', item.last_by === 'player' ? t('admin.inbox.playerReplied') : t('admin.inbox.filter.action'), 'admin-inbox-action'));
    const read = item.player_read_at && Date.parse(item.player_read_at) >= Date.parse(item.answered_at);
    const facts = [when(item.created_at), item.app_version, item.context?.platform, item.context?.quest_ordinal ? 'Q' + item.context.quest_ordinal : null,
      item.journal_count ? t('admin.inbox.fact.journal', { count: item.journal_count }) : null, item.snapshot ? t('admin.inbox.fact.snapshot') : null, item.capture ? t('admin.inbox.fact.capture') : null,
      item.messages ? t('admin.inbox.fact.messages', { count: item.messages }) : null,
      item.answered_at ? (read ? t('admin.inbox.fact.read') : t('admin.inbox.fact.unread')) : null].filter(Boolean);
    summary.append(el(doc, 'small', facts.join(' · ')));
    summary.append(el(doc, 'p', item.message || '', 'admin-inbox-message'));
    card.append(summary);
    const body = el(doc, 'div', null, 'admin-inbox-body');
    card.append(body);
    card.ontoggle = () => {
      if (card.open && !card.dataset.loaded) void detail(item, card, body);
    };
    return card;
  }
  async function detail(item, card, body) {
    card.dataset.loaded = '1';
    body.replaceChildren(el(doc, 'p', t('admin.inbox.detailLoading')));
    let result;
    try {
      result = cache.has(item.id) ? { data: cache.get(item.id) } : await rpc('lumen_admin_feedback_detail', { p_id: item.id });
    } catch {
      result = { error: true };
    }
    if (!authorized() || !card.isConnected) return;
    if (result.error || !result.data) {
      delete card.dataset.loaded;
      body.replaceChildren(el(doc, 'p', t('admin.inbox.detailUnavailable')));
      return;
    }
    const d = result.data;
    cache.set(item.id, d);
    body.replaceChildren();
    // 1. Synthesis first.
    const synthesis = el(doc, 'dl', null, 'admin-inbox-synthesis');
    const add = (label, value) => {
      synthesis.append(el(doc, 'dt', label), el(doc, 'dd', value));
    };
    add(t('admin.inbox.field.version'), [item.app_version || t('admin.inbox.unknownVersion'), item.context?.android_version ? 'Android ' + item.context.android_version : null].filter(Boolean).join(' · '));
    add(t('admin.inbox.field.device'), [item.context?.platform, item.context?.browser, item.context?.screen, item.context?.offline ? t('admin.inbox.snapshot.offline') : null].filter(Boolean).join(' · ') || '—');
    add(t('admin.inbox.field.journal'), d.journal?.length ? t('admin.inbox.fact.events', { count: d.journal.length }) : t('admin.inbox.absent'));
    const capture = CAPTURE_KEYS[d.capture?.state] ? d.capture.state : 'none';
    add(t('admin.inbox.field.capture'), capture === 'received' ? t('admin.inbox.capture.receivedAt', { date: when(d.capture.received_at), bytes: d.capture.bytes }) : t(CAPTURE_KEYS[capture]));
    for (const [label, value] of snapshotSummary(d.snapshot, t)) add(label, value);
    if (!d.snapshot) add(t('admin.inbox.field.snapshot'), item.kind === 'bug' ? t('admin.inbox.snapshotMissing') : t('admin.inbox.snapshotNotAsked'));
    body.append(synthesis);
    // 2. Links: player, sessions/diagnostic, support dossier.
    const links = el(doc, 'div', null, 'admin-inbox-links');
    if (d.player_key) {
      const open = el(doc, 'button', t('admin.inbox.openPlayer'));
      open.type = 'button';
      open.onclick = () => authorized() && onPlayer(d.player_key, { feedbackId: item.id });
      links.append(open);
    } else links.append(el(doc, 'span', t('admin.inbox.guest')));
    body.append(links);
    if (d.capture?.case_id && onDossier) {
      const dossier = el(doc, 'div');
      body.append(dossier);
      void onDossier(dossier, { target: d.player_key?.slice(2) ?? null, reference: d.capture.case_id });
    }
    // 3. Board of that moment, then the raw details, folded.
    const grid = boardText(d.snapshot?.board);
    if (grid) {
      const box = el(doc, 'details');
      box.append(el(doc, 'summary', t('admin.inbox.board')), el(doc, 'pre', grid, 'admin-inbox-board'));
      body.append(box);
    }
    const raw = el(doc, 'details');
    raw.append(el(doc, 'summary', t('admin.inbox.raw')), el(doc, 'pre', JSON.stringify({ context: item.context, snapshot: d.snapshot, journal: d.journal }, null, 1)));
    body.append(raw);
    // 4. Exchange, answer and status.
    const thread = el(doc, 'ol', null, 'admin-inbox-thread');
    const message = (m) => {
      const li = el(doc, 'li');
      li.dataset.by = m.by;
      li.append(el(doc, 'strong', m.by === 'admin' ? t('admin.inbox.team') : t('admin.inbox.player')), ' · ' + when(m.at), el(doc, 'p', m.body));
      return li;
    };
    for (const m of d.thread || []) thread.append(message(m));
    if (!d.thread?.length) thread.append(el(doc, 'li', t('admin.inbox.noExchange')));
    body.append(thread);
    const form = el(doc, 'form', null, 'admin-inbox-reply');
    const area = el(doc, 'textarea');
    area.maxLength = 2000;
    area.rows = 3;
    area.setAttribute('aria-label', t('admin.inbox.replyLabel', { id: item.id }));
    area.placeholder = t('admin.inbox.replyPlaceholder');
    let ref = newRef();
    const answer = el(doc, 'button', t('admin.inbox.reply'));
    answer.type = 'submit';
    const resolve = el(doc, 'button', t('admin.inbox.replyResolve'));
    resolve.type = 'button';
    const select = el(doc, 'select');
    select.setAttribute('aria-label', t('admin.inbox.statusLabel', { id: item.id }));
    for (const value of ['new', 'reviewed', 'answered', 'closed']) {
      const option = el(doc, 'option', inboxStatusLabel(value, t));
      option.value = value;
      option.selected = value === (item.status === 'fixed' ? 'closed' : item.status);
      select.append(option);
    }
    const note = el(doc, 'p', '', 'admin-cockpit-status');
    note.setAttribute('role', 'status');
    form.append(area, answer, resolve, select, note);
    body.append(form);
    const setStatus = (value) => {
      item.status = value;
      card.dataset.status = value;
      card.querySelector('.admin-inbox-status').textContent = inboxStatusLabel(value, t);
      select.value = value === 'fixed' ? 'closed' : value;
    };
    async function send(resolveToo) {
      const text = area.value.trim();
      if (text.length < 2) {
        note.textContent = t('admin.inbox.replyTooShort');
        return;
      }
      answer.disabled = resolve.disabled = true;
      note.textContent = t('admin.inbox.sending');
      try {
        const { data, error } = await rpc('lumen_admin_feedback_reply', { p_id: item.id, p_body: text, p_message_ref: ref, p_resolve: resolveToo });
        if (!authorized() || !card.isConnected) return;
        if (error) throw Error();
        thread.querySelector('li:not([data-by])')?.remove();
        thread.append(message({ by: 'admin', body: text, at: new Date().toISOString() }));
        area.value = '';
        ref = newRef();
        cache.delete(item.id);
        setStatus(data?.status || (resolveToo ? 'closed' : 'answered'));
        note.textContent = t('admin.inbox.replySent');
      } catch {
        // Same reference on retry: never a duplicate answer.
        note.textContent = t('admin.inbox.replyFailed');
      } finally {
        answer.disabled = resolve.disabled = false;
      }
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      void send(false);
    };
    resolve.onclick = () => void send(true);
    select.onchange = async () => {
      select.disabled = true;
      const { error } = await rpc('lumen_admin_feedback_set_status', { p_id: item.id, p_status: select.value }).catch(() => ({ error: true }));
      select.disabled = false;
      if (error) {
        note.textContent = t('admin.inbox.statusFailed');
        select.value = item.status === 'fixed' ? 'closed' : item.status;
      } else {
        setStatus(select.value);
        note.textContent = t('admin.inbox.statusSaved');
      }
    };
  }
  renderChips();
  return { load, filterPlayer, open: (id) => list.querySelector('[data-feedback-id="' + Number(id) + '"]')?.setAttribute('open', '') };
}
