// #974: adventure totals are authoritative server aggregates. The opening read
// returns the podium and my position only; rows below the podium are fetched on
// explicit request, in bounded windows (Free-first): 11 rows centred on me (or
// ranks 4–13), then blocks of 10 before/after. Folding never re-reads. Owner
// mock-up 27/11/2026: lumen-marketing/maquettes/974-classement-aventure.png.
import {createPodium, createRankRow, createMyPosition, createEmptyRanking, rankWindow, formatPoints} from './podium.js';

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
  locale = () => 'fr',
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
  const value = (r) => t('groupRanking.points', { points: formatPoints(r.points, locale()) });
  const button = (className, label, chevron) => {
    const b = el('button', ['lumen-rank-button', className].join(' '));
    b.type = 'button';
    const text = el('span', 'lumen-rank-button-label', label);
    b.append(text);
    if (chevron) b.append(el('span', ['lumen-chevron', 'lumen-chevron-' + chevron].join(' ')));
    b.label = text;
    return b;
  };
  function render(data) {
    body.replaceChildren();
    const top = data.top || [];
    if (!top.length) {
      body.append(createEmptyRanking(document, t('groupRanking.empty')));
      return;
    }
    body.append(createPodium(document, top, { value, t }));
    const onPodium = top.some((r) => r.mine);
    let personal = null;
    if (data.personal && !onPodium) {
      personal = createMyPosition(
        document,
        { place: data.personal.place, nickname: nickname() || t('ranking.you'), points: data.personal.points, mine: true },
        { value, t },
      );
      body.append(personal);
    } else if (!data.personal) {
      body.append(
        el('p', 'lumen-rank-note', data.participating ? t('groupRanking.notRanked', { total: data.questTotal }) : t('ranking.account')),
      );
    }
    if (data.participants <= 3) return;
    const toggle = button('group-ranking-more', t(personal ? 'groupRanking.around' : 'groupRanking.rest'), 'down');
    const before = button('group-ranking-before', t('groupRanking.before'), 'up');
    const list = el('ol', ['lumen-rank-list', 'group-ranking-list'].join(' '));
    const after = button('group-ranking-next', t('groupRanking.after'), 'down');
    const fold = el('button', 'lumen-rank-fold', t('groupRanking.less'));
    fold.type = 'button';
    list.id = 'groupRankingRemainder';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', list.id);
    const win = rankWindow({ place: personal ? data.personal.place : null, total: data.participants });
    let lo = win.offset,
      hi = win.offset,
      expanded = false,
      loaded = false,
      loading = false,
      failed = false,
      listHasMine = false;
    const seen = new Set(top.map((r) => r.nickname));
    const scroller = () => modal.querySelector?.('.group-ranking-card') || null;
    function sync() {
      for (const n of [before, list, after, fold]) n.hidden = !expanded;
      if (expanded) {
        before.hidden = !loaded || lo <= 3;
        after.hidden = !failed && (!loaded || hi >= data.participants);
      }
      toggle.hidden = expanded;
      if (personal) personal.hidden = expanded && listHasMine;
      toggle.setAttribute('aria-expanded', String(expanded));
      after.label.textContent = t(failed ? 'groupRanking.retry' : 'groupRanking.after');
    }
    async function load(offset, limit, where) {
      if (loading || limit <= 0) return;
      loading = true;
      before.disabled = after.disabled = true;
      const token = generation,
        id = adventure;
      try {
        const { data: page, error } = await rpc('lumen_group_ranking', {
          p_kind: 'adventure',
          p_id: id,
          p_offset: offset,
          p_limit: limit,
        });
        if (token !== generation) return;
        if (error || page?.scoringVersion !== 2) throw Error();
        const fetched = page.rows || [];
        // Names are unique: never show a podium player or a row twice.
        const rows = fetched.filter((r) => !seen.has(r.nickname));
        for (const r of rows) {
          seen.add(r.nickname);
          if (r.mine) listHasMine = true;
        }
        const nodes = rows.map((r) => createRankRow(document, r, { value, t }));
        if (where === 'before') {
          // Keep the reading anchor: rows added above do not move what is on screen.
          const box = scroller(),
            height = box?.scrollHeight ?? 0;
          if (list.prepend) list.prepend(...nodes);
          else list.children.unshift(...nodes);
          if (box) box.scrollTop += (box.scrollHeight ?? 0) - height;
          lo = offset;
        } else {
          list.append(...nodes);
          if (!loaded) lo = offset;
          hi = page.more ? offset + fetched.length : data.participants;
        }
        loaded = true;
        failed = false;
      } catch {
        if (token === generation) failed = true;
      } finally {
        loading = false;
        before.disabled = after.disabled = false;
        if (token === generation) sync();
      }
    }
    toggle.onclick = async () => {
      expanded = true;
      sync();
      if (!loaded) await load(win.offset, win.limit, 'after');
      list.querySelector?.('.is-mine')?.scrollIntoView?.({ block: 'center' });
    };
    fold.onclick = () => {
      expanded = false;
      sync();
      toggle.focus?.();
    };
    before.onclick = () => {
      const start = Math.max(3, lo - RANKING_PAGE);
      return load(start, lo - start, 'before');
    };
    after.onclick = () => load(loaded ? hi : win.offset, loaded ? RANKING_PAGE : win.limit, 'after');
    sync();
    body.append(toggle, before, list, after, fold);
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
