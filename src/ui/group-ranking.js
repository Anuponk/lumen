// #974: adventure totals are authoritative server aggregates. Fetch only rows
// after the three podium entries, on explicit expansion. No polling.
export const RANKING_PAGE = 10;
export function rankingPoints(place, participants, { autonomy = false, noError = false } = {}) {
  if (
    !Number.isSafeInteger(place) ||
    !Number.isSafeInteger(participants) ||
    place < 1 ||
    participants < place
  )
    return 0;
  return (
    20 +
    (participants === 1 ? 50 : Math.round((50 * (participants - place)) / (participants - 1))) +
    (autonomy ? 15 : 0) +
    (noError ? 15 : 0)
  );
}
export function createGroupRanking({
  document,
  t,
  rpc,
  signedIn,
  nickname = () => '',
  onOpen = () => {},
  onClose = () => {},
}) {
  const $ = (id) => document.getElementById(id),
    modal = $('groupRankingModal');
  if (!modal) return { open() {}, close() {} };
  const body = $('groupRankingBody'),
    status = $('groupRankingStatus'),
    name = $('groupRankingName');
  let adventure = null,
    generation = 0,
    opener = null;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const row = (r, position) => {
    const li = el('li', 'group-ranking-row' + (r.mine ? ' ranking-mine' : ''));
    if (position) li.dataset.position = String(position);
    li.append(
      el('span', 'ranking-place', r.place),
      el('span', 'ranking-name', r.nickname),
      el('span', 'group-ranking-points', t('groupRanking.points', { points: r.points })),
      el('small', 'group-ranking-quests', t('groupRanking.questsShort', { count: r.quests })),
    );
    if (r.mine) li.append(el('small', 'ranking-you', t('ranking.you')));
    return li;
  };
  // #974 recette 27/11: my line looks like every other ranking line. On the
  // podium, that line is enough; off the podium it follows the podium after a
  // discreet separator and hides while the loaded list already shows it.
  function render(data) {
    body.replaceChildren();
    const top = data.top || [],
      podium = el('ol', 'group-ranking-podium');
    podium.setAttribute('aria-label', t('ranking.top'));
    top.forEach((r, index) => podium.append(row(r, index + 1)));
    body.append(top.length ? podium : el('p', 'ranking-note', t('groupRanking.empty')));
    const onPodium = top.some((r) => r.mine);
    let personal = null;
    if (data.personal && !onPodium) {
      personal = el('ol', 'group-ranking-personal');
      personal.start = data.personal.place;
      personal.append(
        row({
          place: data.personal.place,
          nickname: nickname() || t('ranking.you'),
          points: data.personal.points,
          quests: data.personal.quests,
          mine: true,
        }),
      );
      body.append(personal);
    } else if (!data.personal) {
      body.append(
        el(
          'p',
          'group-ranking-me',
          data.participating
            ? t('groupRanking.notRanked', { total: data.questTotal })
            : t('ranking.account'),
        ),
      );
    }
    body.append(
      el(
        'p',
        'ranking-note',
        t('groupRanking.cap', { quests: data.questTotal, max: data.maxPoints }),
      ),
    );
    if (data.participants <= 3) return;
    const toggle = el(
      'button',
      'group-ranking-more',
      t('groupRanking.all', { count: data.participants }),
    );
    const list = el('ol', 'group-ranking-list'),
      next = el('button', 'group-ranking-next');
    toggle.type = next.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    list.id = 'groupRankingRemainder';
    toggle.setAttribute('aria-controls', list.id);
    list.hidden = next.hidden = true;
    let offset = top.length,
      expanded = false,
      loaded = false,
      loading = false,
      failed = false,
      hasMore = true,
      listHasMine = false;
    const seen = new Set(top.map((r) => r.nickname));
    const remaining = () => Math.max(0, data.participants - offset);
    function sync() {
      list.hidden = !expanded;
      next.hidden = !expanded || !hasMore;
      next.textContent = failed
        ? t('groupRanking.retry')
        : t('groupRanking.more', { count: remaining() });
      if (personal) personal.hidden = expanded && listHasMine;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = t(expanded ? 'groupRanking.less' : 'groupRanking.all', {
        count: data.participants,
      });
    }
    async function page() {
      if (loading || !hasMore) return;
      loading = true;
      next.disabled = true;
      const token = generation,
        id = adventure;
      try {
        const { data: page, error } = await rpc('lumen_group_ranking', {
          p_kind: 'adventure',
          p_id: id,
          p_offset: offset,
          p_limit: RANKING_PAGE,
        });
        if (token !== generation) return;
        if (error || page?.scoringVersion !== 2) throw Error();
        for (const r of page.rows || []) {
          // Names are unique: avoid a visible duplicate if a live rank changed.
          if (!seen.has(r.nickname)) {
            list.append(row(r));
            seen.add(r.nickname);
            if (r.mine) listHasMine = true;
          }
        }
        offset += (page.rows || []).length;
        hasMore = !!page.more && !!page.rows?.length;
        loaded = true;
        failed = false;
      } catch {
        if (token === generation) failed = true;
      } finally {
        loading = false;
        next.disabled = false;
        if (token === generation) sync();
      }
    }
    toggle.onclick = async () => {
      expanded = !expanded;
      sync();
      if (expanded && !loaded) await page();
    };
    next.onclick = page;
    body.append(toggle, list, next);
  }
  async function load() {
    const token = ++generation,
      id = adventure;
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
      const { data, error } = await rpc('lumen_group_ranking', { p_kind: 'adventure', p_id: id });
      if (token !== generation) return;
      if (error || data?.scoringVersion !== 2) throw Error();
      status.textContent = '';
      render(data);
    } catch {
      if (token === generation) status.textContent = t('ranking.unavailable');
    }
  }
  function open({ adventureId, adventureName, origin } = {}) {
    if (!adventureId) return;
    opener = origin || document.activeElement;
    adventure = adventureId;
    name.textContent = adventureName || t('groupRanking.adventure');
    modal.hidden = false;
    onOpen();
    void load();
    $('groupRankingClose')?.focus();
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    generation++;
    onClose();
    if (opener?.isConnected) opener.focus?.();
  }
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
