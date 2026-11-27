// #974: constellation and adventure rankings (owner scale, 24/11/2026). One read
// per opened tab (top 3 + my position); the full list is paged on demand (10 per
// page). Nothing is computed here: points and places come from the materialized
// server aggregates (lumen_group_ranking). Text is always set with textContent.
export const RANKING_PAGE = 10;
export function rankingPoints(place) {
  if (!Number.isInteger(place) || place < 1) return 0;
  return [100, 80, 65, 55, 50][place - 1] ?? Math.max(10, 50 - 2 * (place - 5));
}

export function createGroupRanking({ document, t, rpc, signedIn, onOpen = () => {}, onClose = () => {} }) {
  const $ = (id) => document.getElementById(id);
  const modal = $('groupRankingModal');
  if (!modal) return { open() {}, close() {} };
  const body = $('groupRankingBody'),
    status = $('groupRankingStatus'),
    tabs = [...modal.querySelectorAll('[data-ranking-kind]')];
  let target = null,
    kind = 'constellation',
    generation = 0,
    opener = null;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const row = (r) => {
    const li = el('li', 'group-ranking-row' + (r.mine ? ' ranking-mine' : ''));
    li.append(
      el('span', 'ranking-place', r.place),
      el('span', 'ranking-name', r.nickname),
      el('span', 'group-ranking-points', t('groupRanking.points', { points: r.points })),
      el('small', 'group-ranking-quests', t('groupRanking.questsShort', { count: r.quests })),
    );
    if (r.mine) li.append(el('small', 'ranking-you', t('ranking.you')));
    return li;
  };
  function render(data) {
    body.replaceChildren();
    const podium = el('ol', 'group-ranking-podium');
    podium.setAttribute('aria-label', t('ranking.top'));
    for (const r of data.top || []) podium.append(row(r));
    if (!data.top?.length) body.append(el('p', 'ranking-note', t('groupRanking.empty')));
    else body.append(podium);
    const me = el('p', 'group-ranking-me');
    if (data.personal)
      me.textContent = t('groupRanking.mine', {
        place: data.personal.place,
        participants: data.participants,
        points: data.personal.points,
        quests: data.personal.quests,
        total: data.questTotal,
      });
    else me.textContent = data.participating ? t('groupRanking.notRanked', { total: data.questTotal }) : t('ranking.account');
    body.append(me);
    if (data.participants > 3) {
      const more = el('button', 'group-ranking-more', t('groupRanking.all', { count: data.participants }));
      more.type = 'button';
      const list = el('ol', 'group-ranking-list');
      let offset = 0;
      more.onclick = async () => {
        more.disabled = true;
        const mine = generation;
        try {
          const { data: page, error } = await rpc('lumen_group_ranking', { p_kind: kind, p_id: target[kind], p_offset: offset, p_limit: RANKING_PAGE });
          if (mine !== generation) return;
          if (error) throw Error();
          for (const r of page.rows || []) list.append(row(r));
          offset += RANKING_PAGE;
          more.textContent = t('groupRanking.next');
          more.hidden = !page.more;
        } catch {
          if (mine === generation) more.textContent = t('groupRanking.retry');
        } finally {
          more.disabled = false;
        }
      };
      body.append(list, more);
    }
  }
  async function load() {
    const mine = ++generation;
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.rankingKind === kind));
    body.replaceChildren();
    if (!signedIn()) {
      status.textContent = t('groupRanking.signIn');
      return;
    }
    if (document.defaultView?.navigator?.onLine === false) {
      status.textContent = t('ranking.offline');
      return;
    }
    status.textContent = t('ranking.loading');
    try {
      const { data, error } = await rpc('lumen_group_ranking', { p_kind: kind, p_id: target[kind] });
      if (mine !== generation) return;
      if (error || !data) throw Error();
      status.textContent = '';
      render(data);
    } catch {
      if (mine === generation) status.textContent = t('ranking.unavailable');
    }
  }
  function open({ constellationId, adventureId, constellationName, adventureName, origin, view = 'constellation' } = {}) {
    if (!constellationId || !adventureId) return;
    opener = origin || document.activeElement;
    target = { constellation: constellationId, adventure: adventureId };
    kind = view;
    for (const tab of tabs)
      tab.textContent = tab.dataset.rankingKind === 'constellation' ? constellationName || t('groupRanking.constellation') : adventureName || t('groupRanking.adventure');
    modal.hidden = false;
    onOpen();
    void load();
    tabs.find((tab) => tab.dataset.rankingKind === kind)?.focus();
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    generation++;
    onClose();
    if (opener?.isConnected) opener.focus?.();
  }
  for (const tab of tabs)
    tab.onclick = () => {
      kind = tab.dataset.rankingKind;
      void load();
    };
  $('groupRankingClose')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });
  return { open, close };
}
