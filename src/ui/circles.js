// #929 (EPIC #928, V1): private circles, invitations and private rankings.
import { htmlDocument, createPodium, createMyPosition, createEmptyRanking } from './podium.js';
// Presentation and RPC adapter only: the server owns membership, roles,
// limits, links and the ranking (official scores, public tie rule). Only
// nicknames are ever displayed; tokens are shown once and never stored here.

const CODES = [
  // #1030: creation is Premium once the commercial model is on (server gate).
  'circle_premium_required',
  'account_required',
  'nickname_required',
  'circle_not_found',
  'circle_owner_required',
  'circle_name_invalid',
  'circle_limit_reached',
  'circle_full',
  'circle_already_member',
  'circle_friend_required',
  'circle_invite_cooldown',
  'circle_invite_limit',
  'circle_invite_not_found',
  'circle_link_limit',
  'circle_link_invalid',
  'circle_member_not_found',
  'circle_quest_invalid',
];
const TOKEN = /^[0-9a-f]{64}$/;

// A human message key for any failure; offline and unknown errors included.
export function circleErrorKey(error) {
  const text = String(error?.message || error || '');
  const code = CODES.find((c) => text.includes(c));
  if (code) return 'circles.error.' + code;
  if (/fetch|network|offline|cloud_unavailable/i.test(text)) return 'circles.error.offline';
  return 'circles.error.generic';
}

export function createCircleClient(supabase) {
  async function rpc(name, args = {}) {
    if (!supabase) throw new Error('cloud_unavailable');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  }
  return {
    list: () => rpc('lumen_circle_list'),
    create: (name) => rpc('lumen_circle_create', { p_name: name }),
    rename: (id, name) => rpc('lumen_circle_rename', { p_circle: id, p_name: name }),
    remove: (id) => rpc('lumen_circle_delete', { p_circle: id }),
    leave: (id) => rpc('lumen_circle_leave', { p_circle: id }),
    removeMember: (id, nickname) =>
      rpc('lumen_circle_remove_member', { p_circle: id, p_nickname: nickname }),
    detail: (id) => rpc('lumen_circle_detail', { p_circle: id }),
    inviteFriend: (id, nickname) =>
      rpc('lumen_circle_invite_friend', { p_circle: id, p_nickname: nickname }),
    respond: (invite, accept) =>
      rpc('lumen_circle_respond', { p_invite: invite, p_accept: !!accept }),
    createLink: (id) => rpc('lumen_circle_link_create', { p_circle: id }),
    revokeLink: (id, link) => rpc('lumen_circle_link_revoke', { p_circle: id, p_link: link }),
    previewLink: (token) => rpc('lumen_circle_link_preview', { p_token: token }),
    joinLink: (token) => rpc('lumen_circle_link_join', { p_token: token }),
    board: (id, questId, gridRevision) =>
      rpc('lumen_circle_board', {
        p_circle: id,
        p_quest_id: questId,
        p_grid_revision: gridRevision,
      }),
  };
}

// Private invitation link: only the circle token, never other parameters.
export function circleLinkUrl(token, base) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('circle', token);
  return url.href;
}
export function readCircleToken(href) {
  try {
    const value = new URL(href).searchParams.get('circle');
    return value && TOKEN.test(value) ? value : null;
  } catch {
    return null;
  }
}

// Ranking view model: real performances only; members without a time counted.
export function circleBoardModel(board) {
  const rows = (Array.isArray(board?.top) ? board.top : []).map((row) => ({
    place: Number(row.place),
    nickname: String(row.nickname || ''),
    seconds: Number(row.score),
    mine: row.mine === true,
  }));
  const personal = board?.personal
    ? {
        place: Number(board.personal.place),
        nickname: String(board.personal.nickname || ''),
        seconds: Number(board.personal.score),
        mine: true,
      }
    : null;
  const ranked = Math.max(0, Number(board?.ranked) || 0);
  const members = Math.max(ranked, Number(board?.members) || 0);
  return {
    rows,
    personal,
    personalShown: !!personal && rows.some((r) => r.mine),
    ranked,
    withoutTime: members - ranked,
  };
}

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// #974: the private ranking uses the shared LUMEN podium and cyan position line.
export function renderCircleBoard(board, { t, formatDuration }) {
  const model = circleBoardModel(board);
  const doc = htmlDocument();
  if (!model.ranked) return createEmptyRanking(doc, t('circles.boardEmpty')).outerHTML;
  const value = (row) => formatDuration(row.seconds);
  const rows = model.rows.slice(0, 3).map((row, i) => ({
    ...row,
    position: i + 1,
    nickname: row.mine ? row.nickname + ' ' + t('circles.you') : row.nickname,
  }));
  return (
    createPodium(doc, rows, { value, t, label: t('circles.top3') }).outerHTML +
    (model.personal && !model.personalShown
      ? createMyPosition(doc, model.personal, { value, t, label: t('groupRanking.yourPosition') })
          .outerHTML
      : '') +
    (model.personal ? '' : '<p class="lumen-rank-note">' + esc(t('circles.noTimeYet')) + '</p>') +
    (model.withoutTime
      ? '<p class="circles-note">' +
        esc(t('circles.withoutTime', { count: model.withoutTime })) +
        '</p>'
      : '')
  );
}

// Controller of #circlesModal (list → detail, join by link). Confirmations of
// destructive actions use the shared Lumen dialog (#921) passed as `confirm`.
export function setupCircles({
  doc = document,
  t = (key) => key,
  client,
  isSignedIn = () => false,
  formatDuration = (s) => String(s),
  questLabel = (id) => id,
  friends = async () => [],
  share = async () => {},
  confirm: askConfirmation = (options) => options.onConfirm?.(),
  onSignIn = null,
  onLinkDone = () => {},
  baseUrl = () => globalThis.location?.href || '',
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const modal = $('circlesModal'),
    body = $('circlesBody'),
    status = $('circlesStatus'),
    title = $('circlesTitle'),
    back = $('circlesBack');
  if (!modal || !body) return null;
  let view = 'list',
    current = null,
    detail = null,
    quest = null,
    token = null,
    returnFocus = null,
    waiting = null,
    busy = false;

  const say = (key, params) => {
    if (status) status.textContent = key ? t(key, params) : '';
  };
  // Runs one server action at a time; failures become a human status line.
  async function run(task, done) {
    if (busy) return false;
    busy = true;
    body.setAttribute('aria-busy', 'true');
    say('');
    let result;
    try {
      result = await task();
    } catch (error) {
      say(circleErrorKey(error));
      return false;
    } finally {
      // Only the server call is exclusive; the follow-up may load another view.
      busy = false;
      body.removeAttribute('aria-busy');
    }
    try {
      await done(result);
      return true;
    } catch (error) {
      say(circleErrorKey(error));
      return false;
    }
  }
  const button = (action, label, extra = '') =>
    '<button type="button" data-circle-action="' +
    action +
    '"' +
    extra +
    '>' +
    esc(label) +
    '</button>';
  const section = (heading, html) =>
    '<section class="circles-section">' +
    (heading ? '<h3>' + esc(heading) + '</h3>' : '') +
    html +
    '</section>';
  const note = (text) => '<p class="circles-note">' + esc(text) + '</p>';

  function paint(html, heading) {
    if (title) title.textContent = heading;
    if (back) back.hidden = view === 'list';
    body.innerHTML = html;
    body.querySelector('input,select,button')?.focus({ preventScroll: true });
  }
  function renderSignedOut() {
    clearInterval(waiting);
    waiting = setInterval(() => {
      if (modal.hidden) return clearInterval(waiting);
      if (!isSignedIn()) return;
      clearInterval(waiting);
      void (token ? renderJoin() : renderList());
    }, 1000);
    paint(
      '<p class="circles-empty">' +
        esc(t('circles.accountRequired')) +
        '</p>' +
        (onSignIn ? button('sign-in', t('circles.signIn')) : ''),
      t('circles.title'),
    );
  }

  // Pending invitations, counted by the social hub's global badge.
  function setBadge(count) {
    const badge = $('circlesBadge');
    if (!badge) return;
    badge.hidden = !count;
    badge.textContent = count ? String(count) : '';
  }
  async function refreshBadge() {
    if (!isSignedIn()) return setBadge(0);
    try {
      const data = await client.list();
      setBadge(Array.isArray(data?.invitations) ? data.invitations.length : 0);
    } catch {
      /* keep the last known count while offline */
    }
  }
  async function renderList() {
    view = 'list';
    current = detail = null;
    if (!isSignedIn()) return renderSignedOut();
    const ok = await run(
      () => client.list(),
      (data) => {
        const circles = Array.isArray(data?.circles) ? data.circles : [];
        const invitations = Array.isArray(data?.invitations) ? data.invitations : [];
        setBadge(invitations.length);
        const invites = invitations.length
          ? section(
              t('circles.invitations'),
              '<ul class="circles-list">' +
                invitations
                  .map(
                    (i) =>
                      '<li><span><strong>' +
                      esc(i.name) +
                      '</strong><small>' +
                      esc(
                        t('circles.invitedBy', {
                          name: i.owner || '—',
                          count: Number(i.members) || 0,
                        }),
                      ) +
                      '</small></span>' +
                      button('accept', t('circles.accept'), ' data-id="' + esc(i.id) + '"') +
                      button('decline', t('circles.decline'), ' data-id="' + esc(i.id) + '"') +
                      '</li>',
                  )
                  .join('') +
                '</ul>',
            )
          : '';
        const mine = circles.length
          ? '<ul class="circles-list">' +
            circles
              .map(
                (c) =>
                  '<li>' +
                  button('open', c.name, ' data-id="' + esc(c.id) + '" class="circles-open"') +
                  '<small>' +
                  esc(
                    t(c.role === 'owner' ? 'circles.ownerCount' : 'circles.memberCount', {
                      count: Number(c.members) || 0,
                    }),
                  ) +
                  '</small></li>',
              )
              .join('') +
            '</ul>'
          : '<p class="circles-empty">' + esc(t('circles.empty')) + '</p>';
        const create =
          circles.length < (Number(data?.limits?.circles) || 10)
            ? '<form class="circles-form" data-circle-form="create"><label for="circleNewName">' +
              esc(t('circles.newName')) +
              '</label><input id="circleNewName" maxlength="30" minlength="2" autocomplete="off" required><button type="submit">' +
              esc(t('circles.create')) +
              '</button></form>'
            : note(t('circles.error.circle_limit_reached'));
        paint(
          invites + section(t('circles.mine'), mine + create) + note(t('circles.privacy')),
          t('circles.title'),
        );
      },
    );
    if (!ok)
      paint(
        '<p class="circles-empty">' +
          esc(status?.textContent || '') +
          '</p>' +
          button('retry', t('circles.retry')),
        t('circles.title'),
      );
  }

  async function renderDetail(id) {
    view = 'detail';
    current = id;
    const ok = await run(
      () => client.detail(id),
      async (data) => {
        detail = data;
        const owner = data.role === 'owner';
        const members = Array.isArray(data.members) ? data.members : [];
        const quests = Array.isArray(data.quests) ? data.quests : [];
        if (
          !quest ||
          !quests.some(
            (q) => q.quest_id === quest.quest_id && q.grid_revision === quest.grid_revision,
          )
        )
          quest = quests[0] || null;
        const memberList =
          '<ul class="circles-members">' +
          members
            .map(
              (m) =>
                '<li><span>' +
                esc(m.nickname) +
                (m.me ? ' <small>' + esc(t('circles.you')) + '</small>' : '') +
                (m.role === 'owner'
                  ? ' <small class="circles-owner">' + esc(t('circles.owner')) + '</small>'
                  : '') +
                '</span>' +
                (owner && !m.me
                  ? button(
                      'remove-member',
                      t('circles.removeMember'),
                      ' data-nickname="' + esc(m.nickname) + '"',
                    )
                  : '') +
                '</li>',
            )
            .join('') +
          '</ul>';
        const ranking = section(
          t('circles.ranking'),
          (quests.length
            ? '<label for="circleQuest">' +
              esc(t('circles.quest')) +
              '</label><select id="circleQuest">' +
              quests
                .map(
                  (q, i) =>
                    '<option value="' +
                    i +
                    '"' +
                    (quest &&
                    q.quest_id === quest.quest_id &&
                    q.grid_revision === quest.grid_revision
                      ? ' selected'
                      : '') +
                    '>' +
                    esc(
                      questLabel(q.quest_id, q.grid_revision) +
                        ' · ' +
                        t('circles.players', { count: Number(q.players) || 0 }),
                    ) +
                    '</option>',
                )
                .join('') +
              '</select><div id="circleBoard" aria-live="polite"></div>'
            : '<p class="circles-empty">' + esc(t('circles.noRanking')) + '</p>') +
            note(t('circles.rankingRules')),
        );
        let tools = '';
        if (owner) {
          const all = await friends().catch(() => []);
          const invitable = (Array.isArray(all) ? all : []).filter(
            (n) => !members.some((m) => m.nickname === n),
          );
          const pending =
            Array.isArray(data.pending) && data.pending.length
              ? note(t('circles.pending', { names: data.pending.join(', ') }))
              : '';
          const links = (Array.isArray(data.links) ? data.links : [])
            .map(
              (l) =>
                '<li><small>' +
                esc(t('circles.linkUntil', { date: new Date(l.expires_at).toLocaleDateString() })) +
                '</small>' +
                button('revoke-link', t('circles.revokeLink'), ' data-id="' + esc(l.id) + '"') +
                '</li>',
            )
            .join('');
          tools =
            section(
              t('circles.invite'),
              (invitable.length
                ? '<form class="circles-form" data-circle-form="invite"><label for="circleInviteFriend">' +
                  esc(t('circles.inviteFriend')) +
                  '</label><select id="circleInviteFriend">' +
                  invitable.map((n) => '<option>' + esc(n) + '</option>').join('') +
                  '</select><button type="submit">' +
                  esc(t('circles.send')) +
                  '</button></form>'
                : note(t('circles.noFriendToInvite'))) +
                pending +
                button('create-link', t('circles.createLink')) +
                (links ? '<ul class="circles-links">' + links + '</ul>' : '') +
                note(t('circles.linkRules')),
            ) +
            section(
              '',
              '<form class="circles-form" data-circle-form="rename"><label for="circleRename">' +
                esc(t('circles.rename')) +
                '</label><input id="circleRename" maxlength="30" minlength="2" required value="' +
                esc(data.name) +
                '"><button type="submit">' +
                esc(t('circles.save')) +
                '</button></form>',
            );
        }
        const danger =
          '<section class="circles-section circles-danger">' +
          button('leave', t('circles.leave')) +
          (owner ? button('delete', t('circles.delete')) : '') +
          '</section>';
        paint(
          section(t('circles.members', { count: members.length }), memberList) +
            ranking +
            tools +
            danger,
          data.name,
        );
        if (quest) void loadBoard();
      },
    );
    // A circle that disappeared or that the player left: back to the list.
    if (!ok) {
      const message = status?.textContent || '';
      await renderList();
      if (message) status.textContent = message;
    }
  }

  async function loadBoard() {
    const target = $('circleBoard');
    if (!target || !quest || !current) return;
    try {
      const board = await client.board(current, quest.quest_id, quest.grid_revision);
      if ($('circleBoard') === target)
        target.innerHTML = renderCircleBoard(board, { t, formatDuration });
    } catch (error) {
      target.innerHTML = note(t(circleErrorKey(error)));
    }
  }

  async function renderJoin() {
    view = 'join';
    if (!isSignedIn()) return renderSignedOut();
    const ok = await run(
      () => client.previewLink(token),
      (data) => {
        if (data?.member) {
          token = null;
          onLinkDone();
          return renderList();
        }
        paint(
          '<p>' +
            esc(
              t('circles.joinCopy', {
                name: data?.name || '',
                owner: data?.owner || '—',
                count: Number(data?.members) || 0,
              }),
            ) +
            '</p>' +
            note(t('circles.joinRules')) +
            button('join', t('circles.join')) +
            button('back', t('circles.notNow')),
          t('circles.joinTitle'),
        );
      },
    );
    if (!ok) {
      token = null;
      onLinkDone();
      paint(
        '<p class="circles-empty">' +
          esc(status?.textContent || '') +
          '</p>' +
          button('back', t('circles.myCircles')),
        t('circles.joinTitle'),
      );
    }
  }

  const ask = (key, extra, task, then) =>
    askConfirmation({
      title: t(key + 'Title', extra),
      copy: t(key + 'Copy', extra),
      cancel: t('circles.keep'),
      confirm: t(key + 'Yes'),
      tone: 'danger',
      onConfirm: () => void run(task, then),
    });
  async function act(action, el) {
    const id = el.dataset.id;
    if (action === 'sign-in') return onSignIn?.();
    if (action === 'back' || action === 'retry') {
      if (token) {
        token = null;
        onLinkDone();
      }
      return renderList();
    }
    if (action === 'open') return renderDetail(id);
    if (action === 'accept' || action === 'decline')
      return run(
        () => client.respond(id, action === 'accept'),
        (r) => (r?.state === 'joined' ? renderDetail(r.id) : renderList()),
      );
    if (action === 'join')
      return run(
        () => client.joinLink(token),
        (r) => {
          token = null;
          onLinkDone();
          return renderDetail(r.id);
        },
      );
    if (action === 'create-link')
      return run(
        () => client.createLink(current),
        async (r) => {
          const url = circleLinkUrl(r.token, baseUrl());
          const shared = await share(url, detail?.name);
          await renderDetail(current);
          // Shown once: when neither sharing nor copying worked, display it to copy by hand.
          if (shared === false) say('circles.linkManual', { url });
          else say('circles.linkReady');
        },
      );
    if (action === 'revoke-link')
      return run(
        () => client.revokeLink(current, id),
        () => renderDetail(current),
      );
    if (action === 'remove-member')
      return ask(
        'circles.confirmRemove',
        { name: el.dataset.nickname },
        () => client.removeMember(current, el.dataset.nickname),
        () => renderDetail(current),
      );
    if (action === 'leave')
      return ask(
        'circles.confirmLeave',
        { name: detail?.name || '' },
        () => client.leave(current),
        () => renderList(),
      );
    if (action === 'delete')
      return ask(
        'circles.confirmDelete',
        { name: detail?.name || '' },
        () => client.remove(current),
        () => renderList(),
      );
  }

  body.addEventListener('click', (event) => {
    const el = event.target.closest('[data-circle-action]');
    if (el && body.contains(el)) void act(el.dataset.circleAction, el);
  });
  body.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-circle-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.circleForm;
    if (kind === 'create')
      void run(
        () => client.create($('circleNewName').value),
        (r) => renderDetail(r.id),
      );
    else if (kind === 'rename')
      void run(
        () => client.rename(current, $('circleRename').value),
        async () => {
          await renderDetail(current);
          say('circles.saved');
        },
      );
    else if (kind === 'invite')
      void run(
        () => client.inviteFriend(current, $('circleInviteFriend').value),
        async () => {
          await renderDetail(current);
          say('circles.invited');
        },
      );
  });
  body.addEventListener('change', (event) => {
    if (event.target.id !== 'circleQuest') return;
    quest = detail?.quests?.[Number(event.target.value)] || null;
    void loadBoard();
  });
  function close() {
    clearInterval(waiting);
    modal.hidden = true;
    say('');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (view === 'list') close();
    else void renderList();
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  $('circlesClose')?.addEventListener('click', close);
  back?.addEventListener('click', () => void renderList());
  function open({ link = null } = {}) {
    returnFocus = doc.activeElement;
    modal.hidden = false;
    if (link) token = link;
    return token ? renderJoin() : renderList();
  }
  return {
    open,
    close,
    refreshBadge,
    refresh: () =>
      modal.hidden
        ? null
        : token
          ? renderJoin()
          : view === 'detail' && current
            ? renderDetail(current)
            : renderList(),
  };
}
