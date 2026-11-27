// #1030 lot 2 — LUMEN Premium advanced personal statistics (player view, not the
// admin cockpit #708). One bounded RPC on open (lumen_premium_stats: 20 history
// rows, 90-day series, personal bests), keyset "more" pages on demand, no polling.
// Difficulty is aggregated here from the catalogue. Basic statistics and the badge
// completion table (#985) stay free and are untouched.
import {DIFFICULTY_LABELS} from '../campaign/difficulty.js';

export const STATS_PAGE = 20;

const median = (values) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
};

export function premiumStatsModel(data = {}, {questById = () => null} = {}) {
  const series = Array.isArray(data.series) ? data.series : [];
  const records = Array.isArray(data.records) ? data.records : [];
  const history = Array.isArray(data.history) ? data.history : [];
  const attempts = series.reduce((s, d) => s + (Number(d.attempts) || 0), 0);
  const wins = series.reduce((s, d) => s + (Number(d.wins) || 0), 0);
  const groups = new Map(DIFFICULTY_LABELS.map((label) => [label, []]));
  for (const r of records) {
    const label = questById(r.questId)?.difficulty?.label;
    if (groups.has(label) && Number.isFinite(r.score)) groups.get(label).push(r.score);
  }
  return {
    summary: {
      attempts,
      wins,
      winRate: attempts ? Math.round((100 * wins) / attempts) : null,
      medianSeconds: median(series.map((d) => d.medianSeconds)),
      records: records.length,
      bestScore: records.length ? Math.min(...records.map((r) => r.score).filter(Number.isFinite)) : null,
    },
    series: series.map((d) => ({
      day: d.day,
      attempts: Number(d.attempts) || 0,
      wins: Number(d.wins) || 0,
      medianSeconds: Number.isFinite(d.medianSeconds) ? d.medianSeconds : null,
    })),
    byDifficulty: [...groups]
      .filter(([, scores]) => scores.length)
      .map(([label, scores]) => ({label, count: scores.length, best: Math.min(...scores), median: median(scores)})),
    history: history.map((h) => ({...h, quest: questById(h.questId)})),
  };
}

// Inline SVG, no library: wins per day as bars, median solving time as a line.
export function renderSeriesChart(series = [], {t = (k) => k} = {}) {
  if (!series.length) return '';
  const w = 300, h = 110, pad = 6, n = series.length, step = (w - 2 * pad) / n;
  const maxWins = Math.max(1, ...series.map((d) => d.wins));
  const times = series.map((d) => d.medianSeconds).filter(Number.isFinite);
  const maxTime = Math.max(1, ...times);
  const bars = series.map((d, i) => {
    const bh = ((h - 2 * pad) * d.wins) / maxWins;
    return `<rect class="premium-stats-bar" x="${(pad + i * step + step * 0.15).toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${(step * 0.7).toFixed(1)}" height="${bh.toFixed(1)}"/>`;
  }).join('');
  const points = series
    .map((d, i) => (Number.isFinite(d.medianSeconds) ? `${(pad + i * step + step / 2).toFixed(1)},${(h - pad - ((h - 2 * pad) * d.medianSeconds) / maxTime).toFixed(1)}` : null))
    .filter(Boolean)
    .join(' ');
  const line = points ? `<polyline class="premium-stats-line" fill="none" points="${points}"/>` : '';
  return `<svg class="premium-stats-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t('premiumStats.chartLabel')}">${bars}${line}</svg>`;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export function createPremiumStats({document, t, rpc, owner, questById, questName = (q) => q?.id || '', difficultyLabel = (l) => l, formatDuration = (s) => s + ' s', locale = () => 'fr'}) {
  let modal = null, generation = 0, opener = null;
  function ensure() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'premiumStatsModal';
    modal.className = 'beta-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'premiumStatsTitle');
    modal.innerHTML = '<div class="beta-card premium-stats-card"><div class="beta-head"><h2 id="premiumStatsTitle"></h2><button id="premiumStatsClose" class="beta-close" type="button"></button></div><p id="premiumStatsStatus" class="ranking-note" role="status" aria-live="polite"></p><div id="premiumStatsBody"></div></div>';
    document.body.append(modal);
    modal.querySelector('#premiumStatsClose').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    return modal;
  }
  const date = (iso) => { try { return new Date(iso).toLocaleDateString(locale(), {day: 'numeric', month: 'short'}); } catch { return String(iso).slice(0, 10); } };
  function historyRows(items) {
    return items.map((h) => `<li class="premium-stats-run"><span>${esc(date(h.at))}</span><span class="premium-stats-quest">${esc(questName(h.quest) || h.questId)}</span><span>${esc(h.status === 'confirmed' ? (Number.isFinite(h.seconds) ? formatDuration(h.seconds) : t('premiumStats.won')) : t('premiumStats.unfinished'))}</span>${h.improved ? `<small>${esc(t('premiumStats.record'))}</small>` : ''}</li>`).join('');
  }
  function render(model) {
    const s = model.summary, body = modal.querySelector('#premiumStatsBody');
    const tiles = [
      [t('premiumStats.attempts'), s.attempts],
      [t('premiumStats.winRate'), s.winRate === null ? '—' : s.winRate + ' %'],
      [t('premiumStats.medianTime'), s.medianSeconds === null ? '—' : formatDuration(s.medianSeconds)],
      [t('premiumStats.records'), s.records],
    ].map(([k, v]) => `<div class="premium-stats-tile"><strong>${esc(v)}</strong><span>${esc(k)}</span></div>`).join('');
    const diff = model.byDifficulty.length
      ? `<table class="premium-stats-table"><thead><tr><th>${esc(t('premiumStats.difficulty'))}</th><th>${esc(t('premiumStats.quests'))}</th><th>${esc(t('premiumStats.best'))}</th><th>${esc(t('premiumStats.median'))}</th></tr></thead><tbody>${model.byDifficulty.map((d) => `<tr><td>${esc(difficultyLabel(d.label))}</td><td>${d.count}</td><td>${esc(formatDuration(d.best))}</td><td>${esc(formatDuration(d.median))}</td></tr>`).join('')}</tbody></table>`
      : `<p class="ranking-note">${esc(t('premiumStats.noRecords'))}</p>`;
    body.innerHTML = `<p class="ranking-note">${esc(t('premiumStats.period'))}</p><div class="premium-stats-tiles">${tiles}</div>`
      + `<h3>${esc(t('premiumStats.progress'))}</h3>${renderSeriesChart(model.series, {t}) || `<p class="ranking-note">${esc(t('premiumStats.noData'))}</p>`}<p class="premium-stats-legend">${esc(t('premiumStats.legend'))}</p>`
      + `<h3>${esc(t('premiumStats.byDifficulty'))}</h3>${diff}`
      + `<h3>${esc(t('premiumStats.history'))}</h3><ol id="premiumStatsHistory" class="premium-stats-history">${historyRows(model.history)}</ol>`
      + `<button id="premiumStatsMore" class="group-ranking-next" type="button"${model.history.length < STATS_PAGE ? ' hidden' : ''}>${esc(t('premiumStats.more'))}</button>`;
    let cursor = model.history.at(-1)?.at || null, loading = false;
    const more = body.querySelector('#premiumStatsMore');
    more.onclick = async () => {
      if (loading || !cursor) return;
      loading = true; more.disabled = true;
      const token = generation;
      try {
        const {data, error} = await rpc('lumen_premium_stats', {p_expected_user_id: owner(), p_before: cursor, p_limit: STATS_PAGE});
        if (token !== generation) return;
        if (error) throw error;
        const page = premiumStatsModel({history: data?.history}, {questById}).history;
        body.querySelector('#premiumStatsHistory').insertAdjacentHTML('beforeend', historyRows(page));
        cursor = page.at(-1)?.at || null;
        more.hidden = page.length < STATS_PAGE;
        more.textContent = t('premiumStats.more');
      } catch {
        if (token === generation) more.textContent = t('groupRanking.retry');
      } finally { loading = false; more.disabled = false; }
    };
  }
  async function open({origin} = {}) {
    ensure();
    opener = origin || document.activeElement;
    const token = ++generation, status = modal.querySelector('#premiumStatsStatus');
    modal.querySelector('#premiumStatsTitle').textContent = t('premiumStats.title');
    modal.querySelector('#premiumStatsClose').textContent = t('app.close');
    modal.querySelector('#premiumStatsBody').innerHTML = '';
    modal.hidden = false;
    modal.querySelector('#premiumStatsClose').focus();
    status.textContent = t('premiumStats.loading');
    try {
      const {data, error} = await rpc('lumen_premium_stats', {p_expected_user_id: owner(), p_limit: STATS_PAGE});
      if (token !== generation) return;
      if (error) throw error;
      status.textContent = '';
      render(premiumStatsModel(data, {questById}));
    } catch (error) {
      if (token !== generation) return;
      status.textContent = /premium_required/.test(error?.message || '') ? t('premiumStats.required') : t('premiumStats.unavailable');
    }
  }
  function close() {
    if (!modal || modal.hidden) return;
    generation++;
    modal.hidden = true;
    if (opener?.isConnected) opener.focus?.();
  }
  return {open, close};
}
