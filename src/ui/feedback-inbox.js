// #1020/#960: the administrators' inbox of player reports, inside /admin/analytics.
// The list is paged (30, keyset) and carries no journal, snapshot or capture; one
// report's linked data (journal, snapshot of the moment, capture state, exchange) is
// read only when it is opened. Answers are idempotent (one reference per draft) and
// a failed send keeps the draft. Every DOM text is set with textContent.
const KIND = { bug: 'Bug', question: 'Question', idea: 'Suggestion', rule: 'Règle', difficulty: 'Difficulté', other: 'Autre' };
export const INBOX_STATUS = Object.freeze({ new: 'Reçu', reviewed: 'En cours', answered: 'Réponse disponible', fixed: 'Résolu', closed: 'Résolu' });
const CAPTURE = {
  none: 'Aucune copie complète demandée',
  pending: 'Copie complète en cours d’envoi',
  received: 'Copie complète reçue',
  failed: 'Copie complète non reçue (échec ou envoi interrompu)',
  expired: 'Copie complète expirée',
  deleted: 'Copie complète effacée (désactivation ou purge)',
};
const el = (doc, tag, text, className) => {
  const node = doc.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const when = (value) => {
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toLocaleString('fr-FR') : '—';
};
const newRef = () => {
  try {
    return 'a' + globalThis.crypto.randomUUID().replace(/-/g, '');
  } catch {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
};

// Readable synthesis of the snapshot before any raw detail.
export function snapshotSummary(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const lines = [];
  if (snapshot.taken_at) lines.push(['Moment du signalement', when(snapshot.taken_at)]);
  if (snapshot.surface || snapshot.menu) lines.push(['Écran', [snapshot.surface, snapshot.menu].filter(Boolean).join(' · ')]);
  lines.push(['Connexion', snapshot.online === false ? 'hors ligne' : 'en ligne']);
  const sync = snapshot.sync || {};
  if (sync.hydration) lines.push(['Profil', sync.hydration + (sync.hydration_error ? ' (' + sync.hydration_error + ')' : '')]);
  const pending = ['canonical', 'legacy', 'wallet'].filter((d) => Number.isFinite(sync['pending_' + d]));
  if (pending.length) lines.push(['En attente', pending.map((d) => ({ canonical: 'quêtes', legacy: 'historique', wallet: 'portefeuille' })[d] + ' ' + sync['pending_' + d]).join(' · ')]);
  if (sync.last_success) lines.push(['Dernier succès', sync.last_success + ' · ' + when(sync.last_success_at)]);
  if (sync.last_error) lines.push(['Dernière erreur', sync.last_error + ' · ' + when(sync.last_error_at)]);
  if (snapshot.storage) lines.push(['Stockage', [snapshot.storage.ratio !== undefined ? snapshot.storage.ratio + ' %' : null, snapshot.storage.error].filter(Boolean).join(' · ') || '—']);
  if (snapshot.quest) lines.push(['Quête', [snapshot.quest.adventure, snapshot.quest.ordinal ? 'Q' + snapshot.quest.ordinal : null, snapshot.quest.id].filter(Boolean).join(' · ')]);
  if (snapshot.attempt) {
    const a = snapshot.attempt;
    const helps = Object.entries(a).filter(([k]) => k.startsWith('help_')).map(([k, v]) => k.slice(5) + ' ' + v);
    lines.push(['Tentative', [a.state, a.mode, Number.isFinite(a.elapsed_s) ? a.elapsed_s + ' s' : null, a.qualifying ? 'qualifiante' : null, a.assistance ? 'aide utilisée' : null, a.mistake ? 'erreur commise' : null, a.resets ? a.resets + ' reset(s)' : null, ...helps].filter(Boolean).join(' · ')]);
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

export function mountFeedbackInbox(host, { rpc, authorized, days = () => 30, onPlayer = () => {}, onDossier = null }) {
  if (!host) return { load() {}, filterPlayer() {} };
  const doc = host.ownerDocument;
  const state = { status: 'action', kind: '', player: null, playerLabel: '', items: [], next: null, counts: null, request: 0 };
  const cache = new Map();
  host.replaceChildren();
  const filters = el(doc, 'div', null, 'admin-inbox-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filtrer les signalements');
  const statuses = [['action', 'À traiter'], ['all', 'Tous'], ['new', 'Reçus'], ['reviewed', 'En cours'], ['answered', 'Réponse disponible'], ['closed', 'Résolus']];
  const chips = statuses.map(([value, label]) => {
    const chip = el(doc, 'button', label);
    chip.type = 'button';
    chip.dataset.inboxStatus = value;
    chip.onclick = () => {
      state.status = value;
      void load();
    };
    filters.append(chip);
    return [value, label, chip];
  });
  const kind = el(doc, 'select');
  kind.setAttribute('aria-label', 'Catégorie');
  for (const [value, label] of [['', 'Toutes catégories'], ['bug', 'Bugs'], ['question', 'Questions'], ['idea', 'Suggestions'], ['other', 'Anciens retours']]) {
    const option = el(doc, 'option', label);
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
  const more = el(doc, 'button', 'Charger les signalements plus anciens');
  more.type = 'button';
  more.hidden = true;
  more.onclick = () => load({ append: true });
  host.append(filters, status, list, more);

  function renderChips() {
    for (const [value, label, chip] of chips) {
      const n = state.counts ? (value === 'all' ? state.counts.all : state.counts[value]) : null;
      chip.textContent = label + (Number.isFinite(n) ? ' ' + n : '');
      chip.setAttribute('aria-pressed', String(state.status === value));
    }
    player.hidden = !state.player;
    player.textContent = state.player ? 'Joueur : ' + state.playerLabel + ' ✕' : '';
    player.setAttribute('aria-label', 'Retirer le filtre joueur ' + state.playerLabel);
  }
  async function load({ append = false } = {}) {
    if (!authorized()) return;
    const request = ++state.request;
    if (!append) {
      state.items = [];
      state.next = null;
      list.replaceChildren();
    }
    status.textContent = 'Chargement…';
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
      status.textContent = 'Signalements indisponibles. Réessayez.';
      return;
    }
    const data = result.data || {};
    state.counts = data.counts || null;
    const items = Array.isArray(data.items) ? data.items : [];
    state.items.push(...items);
    state.next = data.next_before ?? null;
    for (const item of items) list.append(row(item));
    status.textContent = state.items.length ? '' : 'Aucun signalement pour ces filtres.';
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
    const title = el(doc, 'strong', 'n° ' + item.id + ' · ' + (KIND[item.kind] || item.kind) + ' · ' + (item.player_label || 'Joueur'));
    const badge = el(doc, 'span', INBOX_STATUS[item.status] || item.status, 'admin-inbox-status');
    summary.append(title, ' ', badge);
    if (item.needs_action) summary.append(' ', el(doc, 'span', item.last_by === 'player' ? 'Nouvelle réponse du joueur' : 'À traiter', 'admin-inbox-action'));
    const facts = [when(item.created_at), item.app_version, item.context?.platform, item.context?.quest_ordinal ? 'Q' + item.context.quest_ordinal : null,
      item.journal_count ? 'journal ' + item.journal_count : null, item.snapshot ? 'instantané' : null, item.capture ? 'copie complète' : null,
      item.messages ? item.messages + ' message(s)' : null,
      item.answered_at ? (item.player_read_at && Date.parse(item.player_read_at) >= Date.parse(item.answered_at) ? 'réponse lue' : 'réponse non lue') : null].filter(Boolean);
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
    body.replaceChildren(el(doc, 'p', 'Chargement du diagnostic…'));
    let result;
    try {
      result = cache.has(item.id) ? { data: cache.get(item.id) } : await rpc('lumen_admin_feedback_detail', { p_id: item.id });
    } catch {
      result = { error: true };
    }
    if (!authorized() || !card.isConnected) return;
    if (result.error || !result.data) {
      delete card.dataset.loaded;
      body.replaceChildren(el(doc, 'p', 'Détail indisponible. Refermez et rouvrez pour réessayer.'));
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
    add('Version', [item.app_version || 'inconnue', item.context?.android_version ? 'Android ' + item.context.android_version : null].filter(Boolean).join(' · '));
    add('Appareil', [item.context?.platform, item.context?.browser, item.context?.screen, item.context?.offline ? 'hors ligne' : null].filter(Boolean).join(' · ') || '—');
    add('Journal technique', d.journal?.length ? d.journal.length + ' événement(s)' : 'absent');
    add('Copie complète', CAPTURE[d.capture?.state] || CAPTURE.none + (d.capture?.received_at ? ' · ' + when(d.capture.received_at) : ''));
    if (d.capture?.state === 'received') synthesis.lastChild.textContent = CAPTURE.received + ' · ' + when(d.capture.received_at) + ' · ' + d.capture.bytes + ' octets';
    for (const [label, value] of snapshotSummary(d.snapshot)) add(label, value);
    if (!d.snapshot) add('Instantané', item.kind === 'bug' ? 'absent (signalement antérieur ou envoi sans instantané)' : 'non demandé pour cette catégorie');
    body.append(synthesis);
    // 2. Links: player, sessions/diagnostic, support dossier.
    const links = el(doc, 'div', null, 'admin-inbox-links');
    if (d.player_key) {
      const open = el(doc, 'button', 'Voir le joueur et ses sessions');
      open.type = 'button';
      open.onclick = () => authorized() && onPlayer(d.player_key, { feedbackId: item.id });
      links.append(open);
    } else links.append(el(doc, 'span', 'Visiteur sans compte : pas de fiche joueur.'));
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
      box.append(el(doc, 'summary', 'Grille au moment du signalement'), el(doc, 'pre', grid, 'admin-inbox-board'));
      body.append(box);
    }
    const raw = el(doc, 'details');
    raw.append(el(doc, 'summary', 'Détails techniques bruts'), el(doc, 'pre', JSON.stringify({ context: item.context, snapshot: d.snapshot, journal: d.journal }, null, 1)));
    body.append(raw);
    // 4. Exchange, answer and status.
    const thread = el(doc, 'ol', null, 'admin-inbox-thread');
    const message = (m) => {
      const li = el(doc, 'li');
      li.dataset.by = m.by;
      li.append(el(doc, 'strong', m.by === 'admin' ? 'Équipe Lumen' : 'Joueur'), ' · ' + when(m.at), el(doc, 'p', m.body));
      return li;
    };
    for (const m of d.thread || []) thread.append(message(m));
    if (!d.thread?.length) thread.append(el(doc, 'li', 'Pas encore d’échange.'));
    body.append(thread);
    const form = el(doc, 'form', null, 'admin-inbox-reply');
    const area = el(doc, 'textarea');
    area.maxLength = 2000;
    area.rows = 3;
    area.setAttribute('aria-label', 'Réponse au joueur (n° ' + item.id + ')');
    area.placeholder = 'Réponse visible par le joueur dans « Mes signalements »';
    let ref = newRef();
    const answer = el(doc, 'button', 'Répondre');
    answer.type = 'submit';
    const resolve = el(doc, 'button', 'Répondre et résoudre');
    resolve.type = 'button';
    const select = el(doc, 'select');
    select.setAttribute('aria-label', 'Statut du signalement n° ' + item.id);
    for (const [value, label] of [['new', 'Reçu'], ['reviewed', 'En cours'], ['answered', 'Réponse disponible'], ['closed', 'Résolu']]) {
      const option = el(doc, 'option', label);
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
      card.querySelector('.admin-inbox-status').textContent = INBOX_STATUS[value] || value;
      select.value = value === 'fixed' ? 'closed' : value;
    };
    async function send(resolveToo) {
      const text = area.value.trim();
      if (text.length < 2) {
        note.textContent = 'Écrivez la réponse (2 caractères minimum).';
        return;
      }
      answer.disabled = resolve.disabled = true;
      note.textContent = 'Envoi…';
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
        note.textContent = 'Réponse envoyée. Le joueur la verra dans « Mes signalements ».';
      } catch {
        // Same reference on retry: never a duplicate answer.
        note.textContent = 'Réponse non confirmée. Le texte est gardé : réessayez.';
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
        note.textContent = 'Statut non enregistré.';
        select.value = item.status === 'fixed' ? 'closed' : item.status;
      } else {
        setStatus(select.value);
        note.textContent = 'Statut enregistré.';
      }
    };
  }
  renderChips();
  return { load, filterPlayer, open: (id) => list.querySelector('[data-feedback-id="' + Number(id) + '"]')?.setAttribute('open', '') };
}
