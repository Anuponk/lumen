// #974 / #1029 — LUMEN ranking components shared by every leaderboard: adventure
// ranking, quest and victory podiums, Défi du jour (global, friends, history, week,
// seasonal days) and private circles. One builder for DOM and for HTML strings
// (htmlDocument), one class contract and one stylesheet section (styles.css « #974
// LUMEN podium »). Pure presentation: ranks, ties and values always come from the
// server; no fictitious row is ever drawn.
//
// Class contract (kept from the quest podium so victory layouts stay stable):
//   ol.lumen-podium.ranking-podium > li.lumen-step.ranking-row.ranking-step-N
//   [.lumen-medal > .lumen-medal-rank] .ranking-name .ranking-time(.lumen-value)
//   li.lumen-rank-row (rank, name, value) · div.lumen-my-position (cyan outline)

// Minimal string document: same builder, serialisable output (escaped text).
const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class HtmlNode {
  constructor(tag) { this.tagName = tag; this.className = ''; this.children = []; this.attrs = {}; this.dataset = {}; this.text = ''; this.hidden = false; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  set textContent(v) { this.text = String(v ?? ''); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  get outerHTML() {
    const attrs = [this.className ? ` class="${esc(this.className)}"` : '', this.hidden ? ' hidden' : '',
      ...Object.entries(this.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`),
      ...Object.entries(this.dataset).map(([k, v]) => ` data-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${esc(v)}"`)].join('');
    return `<${this.tagName}${attrs}>${esc(this.text)}${this.children.map((c) => c.outerHTML).join('')}</${this.tagName}>`;
  }
}
export function htmlDocument() { return {createElement: (tag) => new HtmlNode(tag)}; }

const cls = (...names) => names.filter(Boolean).join(' ');
const node = (doc, tag, className, text) => {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
};

// Top three in podium order 2 – 1 – 3. Positions come from the server order (ties
// keep their shared place in the medallion; the step follows the stable order).
export function podiumSteps(top = []) {
  const rows = top.slice(0, 3).map((row, i) => ({...row, position: row.position ?? i + 1}));
  return [rows[1], rows[0], rows[2]].filter(Boolean);
}

export function createPodium(doc, top, {value = (r) => r.value, t = (k) => k, you = true, label} = {}) {
  const list = node(doc, 'ol', cls('lumen-podium', 'ranking-podium'));
  list.setAttribute('aria-label', label || t('ranking.top'));
  for (const row of podiumSteps(top)) {
    const li = node(doc, 'li', cls('lumen-step', 'ranking-row', 'ranking-step-' + row.position, row.mine && 'ranking-mine', row.mine && 'is-mine'));
    li.dataset.position = String(row.position);
    li.setAttribute('title', String(row.nickname ?? ''));
    const medal = node(doc, 'span', 'lumen-medal');
    medal.setAttribute('aria-hidden', 'true');
    medal.append(node(doc, 'span', 'lumen-medal-rank', row.place ?? row.position));
    li.append(
      medal,
      node(doc, 'span', cls('lumen-sr', 'ranking-place'), row.place ?? row.position),
      node(doc, 'span', 'ranking-name', row.nickname),
      node(doc, 'span', cls('ranking-time', 'lumen-value'), value(row)),
    );
    if (row.mine && you) li.append(node(doc, 'small', cls('ranking-you', 'lumen-sr'), t('ranking.you')));
    list.append(li);
  }
  return list;
}

export function createRankRow(doc, row, {value = (r) => r.value, t = (k) => k} = {}) {
  const li = node(doc, 'li', cls('lumen-rank-row', row.mine && 'is-mine'));
  li.dataset.place = String(row.place);
  li.append(node(doc, 'span', 'lumen-rank', row.place), node(doc, 'span', 'lumen-rank-name', row.nickname), node(doc, 'span', 'lumen-rank-value', value(row)));
  if (row.mine) li.append(node(doc, 'span', 'lumen-sr', t('ranking.you')));
  return li;
}

export function createMyPosition(doc, row, {value = (r) => r.value, t = (k) => k, label} = {}) {
  const box = node(doc, 'div', 'lumen-my-position'), icon = node(doc, 'span', 'lumen-my-icon');
  icon.setAttribute('aria-hidden', 'true');
  box.append(icon, node(doc, 'span', 'lumen-my-label', label || t('groupRanking.yourPosition')),
    node(doc, 'span', 'lumen-rank', row.place), node(doc, 'span', 'lumen-rank-name', row.nickname), node(doc, 'span', 'lumen-rank-value', value(row)));
  return box;
}

export function createEmptyRanking(doc, text) {
  const box = node(doc, 'div', 'lumen-ranking-empty');
  box.append(node(doc, 'span', 'lumen-ranking-empty-sky'), node(doc, 'p', '', text));
  return box;
}

// Window of rows centred on a ranked player, below the podium (server offsets are
// 0-based positions in the stable order): 5 before, the player, 5 after. A podium
// player (or an unranked one) starts at rank 4. Bounds never invent rows.
export function rankWindow({place = null, podium = 3, before = 5, after = 5, total = Infinity} = {}) {
  const span = before + 1 + after;
  if (!Number.isSafeInteger(place) || place <= podium) return {offset: podium, limit: Math.max(0, Math.min(span - 1, total - podium))};
  let offset = Math.max(podium, place - 1 - before);
  const end = Math.min(total, offset + span);
  offset = Math.max(podium, Math.min(offset, end - span));
  return {offset, limit: Math.max(0, end - offset)};
}

export function formatPoints(points, locale = 'fr') {
  try { return new Intl.NumberFormat(locale).format(points); } catch { return String(points); }
}
